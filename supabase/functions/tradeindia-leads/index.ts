import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize phone number to 10-digit Indian mobile form.
// Strips +91 / 91 / 0 / 00 prefixes; preserves a pure 10-digit number that happens to start with "91".
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

function extractProductKey(productName: string | null | undefined): string | null {
  if (!productName) return null;
  const cleaned = productName.replace(/['"`]/g, ' ').trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  for (const t of tokens) {
    const tok = t.replace(/[^A-Za-z0-9\-]/g, '');
    if (tok.length >= 4 && /[0-9]/.test(tok) && /[A-Za-z]/.test(tok)) return tok;
  }
  return cleaned.toLowerCase().slice(0, 60);
}

function parseTradeIndiaTime(timeStr?: string | null): string {
  if (!timeStr) return new Date().toISOString();
  const str = String(timeStr).trim();
  if (!str) return new Date().toISOString();
  
  if (/[+\-Z]/.test(str.slice(-6))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  
  // DD-MM-YYYY HH:mm:ss
  const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (ddmmyyyy) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = ddmmyyyy;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  
  // YYYY-MM-DD HH:mm:ss
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (yyyymmdd) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = yyyymmdd;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  
  const fallback = new Date(str.replace(' ', 'T') + '+05:30');
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

async function findOpenRecentLead(
  supabase: any,
  opts: { source: string; tenantId: string | null; customerId: string; productKey: string | null }
): Promise<{ id: string; assigned_to: string | null } | null> {
  if (!opts.customerId) return null;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = supabase
    .from('leads')
    .select('id, title, customer_query, assigned_to')
    .eq('source', opts.source)
    .eq('customer_id', opts.customerId)
    .gte('created_at', since)
    .not('status', 'in', '(won,lost)')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (opts.tenantId) q = q.eq('tenant_id', opts.tenantId);
  const { data: rows } = await q.limit(20);
  if (!rows || rows.length === 0) return null;
  if (!opts.productKey) return { id: rows[0].id, assigned_to: rows[0].assigned_to ?? null };
  const needle = opts.productKey.toLowerCase();
  const match = rows.find((r: any) =>
    (r.title || '').toLowerCase().includes(needle) ||
    (r.customer_query || '').toLowerCase().includes(needle)
  );
  return match ? { id: match.id, assigned_to: match.assigned_to ?? null } : null;
}

async function getLucknowOfficeId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('offices')
    .select('id')
    .eq('location', 'lucknow')
    .single();
  return data?.id || null;
}

async function getAssignableRoles(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('integration_type', 'lead_config')
    .single();
  
  const config = data?.config as { assignable_roles?: string[] } | null;
  return config?.assignable_roles || ['sales'];
}

async function getAssignableUsers(supabase: any, lucknowOfficeId: string): Promise<string[]> {
  const assignableRoles = await getAssignableRoles(supabase);
  console.log(`Using assignable roles for round-robin: ${assignableRoles.join(', ')}`);

  const { data: roleUsers } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', assignableRoles);

  if (!roleUsers || roleUsers.length === 0) return [];

  const userIds = roleUsers.map((r: any) => r.user_id);

  // Filter out users who have opted out of lead assignment
  const { data: lucknowUsers } = await supabase
    .from('profiles')
    .select('id')
    .eq('office_id', lucknowOfficeId)
    .eq('is_active', true)
    .neq('lead_assignment_opt_out', true)
    .in('id', userIds)
    .order('id', { ascending: true });

  const assignableCount = lucknowUsers?.length || 0;
  console.log(`Found ${assignableCount} users eligible for lead assignment (excluding opted-out users)`);

  return lucknowUsers?.map((u: any) => u.id) || [];
}

async function isUserOnLeave(supabase: any, userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('leave_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1);
  
  return (data && data.length > 0);
}

async function getNextRoundRobinUser(
  supabase: any,
  lucknowOfficeId: string,
  lucknowSalesUsers: string[]
): Promise<string | null> {
  if (lucknowSalesUsers.length === 0) return null;

  const { data: tracker } = await supabase
    .from('round_robin_tracker')
    .select('last_assigned_user_id')
    .eq('office_id', lucknowOfficeId)
    .single();

  const lastUserId = tracker?.last_assigned_user_id;
  
  let startIndex = 0;
  if (lastUserId) {
    const lastIndex = lucknowSalesUsers.indexOf(lastUserId);
    if (lastIndex !== -1) {
      startIndex = (lastIndex + 1) % lucknowSalesUsers.length;
    }
  }

  for (let i = 0; i < lucknowSalesUsers.length; i++) {
    const index = (startIndex + i) % lucknowSalesUsers.length;
    const userId = lucknowSalesUsers[index];
    
    const onLeave = await isUserOnLeave(supabase, userId);
    if (!onLeave) {
      await supabase
        .from('round_robin_tracker')
        .upsert({
          office_id: lucknowOfficeId,
          last_assigned_user_id: userId,
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'office_id' });
      
      console.log(`Round-robin assigned to user: ${userId}`);
      return userId;
    }
    console.log(`Skipping user ${userId} - on leave`);
  }

  console.log('All Lucknow sales users on leave, assigning to first available');
  const fallbackUser = lucknowSalesUsers[0];
  
  await supabase
    .from('round_robin_tracker')
    .upsert({
      office_id: lucknowOfficeId,
      last_assigned_user_id: fallbackUser,
      last_assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'office_id' });
  
  return fallbackUser;
}

async function assignLead(
  supabase: any,
  customerId: string | null,
  customerState: string | null,
  customerCity: string | null,
  lucknowOfficeId: string
): Promise<string | null> {
  // PRIORITY 1: Customer Loyalty
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('assigned_sales_id')
      .eq('id', customerId)
      .single();

    if (customer?.assigned_sales_id) {
      console.log(`[Customer Loyalty] Assigning to existing salesperson: ${customer.assigned_sales_id}`);
      return customer.assigned_sales_id;
    }
  }

  // PRIORITY 2: Location-based assignment rules
  if (customerState) {
    const normalizedState = customerState.toLowerCase().trim();
    
    const { data: rules } = await supabase
      .from('lead_assignment_rules')
      .select('*')
      .eq('is_active', true)
      .not('state', 'is', null)
      .order('priority', { ascending: false });

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const ruleStates = rule.state
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter((s: string) => s.length > 0);
        
        if (ruleStates.includes(normalizedState)) {
          const onLeave = await isUserOnLeave(supabase, rule.assigned_user_id);
          if (!onLeave) {
            console.log(`[State Rule] Matched: ${rule.rule_name} for state: ${customerState}`);
            return rule.assigned_user_id;
          }
          console.log(`[State Rule] User ${rule.assigned_user_id} matched but on leave, falling to round-robin`);
        }
      }
    }
  }

  // PRIORITY 3: Round-robin
  const assignableUsers = await getAssignableUsers(supabase, lucknowOfficeId);

  if (assignableUsers.length === 0) {
    console.log('No Lucknow assignable users found for round-robin');
    return null;
  }

  return await getNextRoundRobinUser(supabase, lucknowOfficeId, assignableUsers);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: { source?: string; account_id?: string } = {};
  try {
    const clonedReq = req.clone();
    requestBody = await clonedReq.json();
  } catch {
    // No body or invalid JSON
  }

  const isScheduledSync = requestBody.source === 'cron';
  const specificAccountId = requestBody.account_id;
  
  console.log(`TradeIndia sync triggered - Source: ${isScheduledSync ? 'cron' : 'manual'}${specificAccountId ? `, Account: ${specificAccountId}` : ''}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lucknowOfficeId = await getLucknowOfficeId(supabase);
    if (!lucknowOfficeId) {
      console.error('Lucknow office not found');
      return new Response(JSON.stringify({ error: 'Lucknow office not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration_type', 'tradeindia')
      .single();

    if (settingsError || !settings) {
      console.error('Failed to fetch TradeIndia settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Integration not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.is_enabled) {
      return new Response(JSON.stringify({ error: 'Integration not enabled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accountsQuery = supabase
      .from('integration_accounts')
      .select('*')
      .eq('integration_setting_id', settings.id)
      .eq('is_enabled', true);

    if (specificAccountId) {
      accountsQuery = accountsQuery.eq('id', specificAccountId);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      console.error('Failed to fetch accounts:', accountsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch accounts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ error: 'No enabled accounts found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalLeadsCreated = 0;
    let totalCustomersCreated = 0;
    let totalFetched = 0;
    const accountResults: Array<{ account: string; leads_synced: number; error?: string }> = [];

    for (const account of accounts) {
      console.log(`Processing account: ${account.account_name} (${account.account_type})`);

      const { data: logEntry, error: logError } = await supabase
        .from('integration_logs')
        .insert({
          integration_type: 'tradeindia',
          status: 'pending',
          tenant_id: account.tenant_id || null,
          metadata: { 
            started_at: new Date().toISOString(),
            account_id: account.id,
            account_name: account.account_name,
            account_type: account.account_type,
          }
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to create log entry:', logError);
      }

      try {
        const baseUrl = account.account_type === 'buy_leads'
          ? 'https://www.tradeindia.com/utils/my_buy_leads.html'
          : 'https://www.tradeindia.com/utils/my_inquiry.html';

        const userid = (account.userid || Deno.env.get('TRADEINDIA_USER_ID') || '15640700').trim();
        const profileId = (account.profile_id || Deno.env.get('TRADEINDIA_PROFILE_ID') || '33509782').trim();
        const apiKey = (account.api_key || Deno.env.get('TRADEINDIA_API_KEY') || '').trim();

        // TradeIndia strictly enforces max 24 hours per query. We query today and yesterday.
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const datesToQuery = [todayStr, yesterdayStr];

        console.log(`Fetching leads from TradeIndia ${account.account_type} API for dates: ${datesToQuery.join(', ')}`);
        const maskedKey = apiKey.slice(0, 4) + '***' + apiKey.slice(-4);
        console.log(`API URL (masked): ${baseUrl}?userid=${userid}&profile_id=${profileId}&key=${maskedKey}&from_date=${todayStr}&to_date=${todayStr}`);

        let allLeads: any[] = [];
        const modes = account.account_type === 'buy_leads' ? ['', '&responded_buy_leads=1'] : [''];

        for (const dateStr of datesToQuery) {
          for (const mode of modes) {
            let pageNo = 1;
            let hasMore = true;

            while (hasMore) {
              const apiUrl = `${baseUrl}?userid=${userid}&profile_id=${profileId}&key=${apiKey}&from_date=${dateStr}&to_date=${dateStr}&limit=50&page_no=${pageNo}${mode}`;
              
              const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json, text/plain, */*',
                  'Cache-Control': 'no-cache',
                },
              });
              
              if (!response.ok) {
                console.warn(`TradeIndia API returned HTTP status ${response.status} for ${dateStr} (mode: ${mode})`);
                break;
              }
              
              const responseText = await response.text();
              if (responseText.includes('maintenance') || responseText.includes('undergoing maintenance')) {
                throw new Error('TradeIndia API is currently under maintenance. Please try again later.');
              }
              
              let data: any;
              try {
                data = JSON.parse(responseText);
                while (typeof data === 'string') {
                  data = JSON.parse(data);
                }
              } catch {
                console.warn('Failed to parse TradeIndia response for', dateStr);
                break;
              }

              if (data?.STATUS === 'FAILURE' || data?.error) {
                console.warn('TradeIndia API warning for', dateStr, data);
                break;
              }

              let batch: any[] = [];
              if (Array.isArray(data)) {
                batch = data;
              } else if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                const hasNumericKeys = keys.length > 0 && keys.some(k => !isNaN(Number(k)) && Number(k) >= 0);
                if (hasNumericKeys) {
                  batch = Object.values(data);
                } else {
                  batch = data.data || data.RESPONSE || data.leads || data.leads_list || data.result || [];
                }
              }

              if (batch.length === 0) {
                hasMore = false;
              } else {
                allLeads.push(...batch);
                if (batch.length < 50) {
                  hasMore = false;
                } else {
                  pageNo++;
                }
              }
            }
          }
        }

        // Deduplicate leads within this batch by unique lead ID
        const seenRefIds = new Set<string>();
        const uniqueLeads: any[] = [];
        for (const it of allLeads) {
          const ref = String(it.lead_id || it.rfi_id || it.query_id || it.QUERY_ID || it.id || '').trim();
          if (ref) {
            if (seenRefIds.has(ref)) continue;
            seenRefIds.add(ref);
          }
          uniqueLeads.push(it);
        }

        const leads = uniqueLeads;
        console.log(`Found ${leads.length} unique TradeIndia leads in response for account ${account.account_name}`);
        
        if (leads.length > 0) {
          console.log('First lead structure:', JSON.stringify(leads[0]).substring(0, 500));
        }
        
        let leadsCreated = 0;
        let customersCreated = 0;

        for (const lead of leads) {
          try {
            // Support both Direct Inquiries (flat fields) and Purchase Leads (nested contact_details)
            const contact = lead.contact_details || {};
            const rawPhone = contact.contact_number || contact.phone_no || lead.sender_mobile || lead.mobile || lead.SENDER_MOBILE || '';
            const email = (lead.sender_email && lead.sender_email !== 'NA' ? lead.sender_email : contact.contact_email || lead.email || lead.SENDER_EMAIL || '').trim().toLowerCase() || null;
            const contactName = contact.user_name || lead.sender_name || lead.contact_name || lead.SENDER_NAME || 'TradeIndia Buyer';
            const companyName = lead.co_name || lead.company_name || lead.sender_company || lead.sender_co || lead.SENDER_COMPANY || (contactName ? `${contactName} (TradeIndia Lead)` : 'Unknown Company');
            const city = contact.city || lead.sender_city || lead.city || lead.SENDER_CITY || null;
            const state = contact.state || lead.sender_state || lead.state || lead.SENDER_STATE || null;
            const address = contact.address || lead.sender_address || lead.address || lead.SENDER_ADDRESS || null;
            const queryId = String(lead.lead_id || lead.rfi_id || lead.query_id || lead.QUERY_ID || '').trim() || `TI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const subject = lead.product_name || lead.subject || lead.SUBJECT || 'TradeIndia Lead';
            const message = [
              lead.description || lead.message || lead.query_message || lead.QUERY_MESSAGE || '',
              lead.specification ? `Specification: ${lead.specification}` : '',
              lead.quantity ? `Quantity: ${lead.quantity} ${lead.unit || ''}` : ''
            ].filter(Boolean).join('\n\n');
            const productName = lead.product_name || lead.QUERY_PRODUCT_NAME || '';

            if (!rawPhone && !email) {
              console.log('Skipping lead without contact info:', queryId);
              continue;
            }

            const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : '';
            
            let customerId: string | null = null;
            let existingCustomer: any = null;

            // Look for existing customer using normalized phone pattern matching
            if (normalizedPhone && normalizedPhone.length === 10) {
              const { data: existingCustomerData } = await supabase
                .from('customers')
                .select('id, assigned_sales_id, phone')
                .or(`phone.like.%${normalizedPhone},alternate_phone.like.%${normalizedPhone}`)
                .limit(1)
                .maybeSingle();
              
              existingCustomer = existingCustomerData;
            } else if (email) {
              const { data: existingCustomerData } = await supabase
                .from('customers')
                .select('id, assigned_sales_id')
                .eq('email', email)
                .maybeSingle();
              
              existingCustomer = existingCustomerData;
            }

            if (existingCustomer) {
              customerId = existingCustomer.id;
              console.log(`[Customer Found] Matched existing customer ${customerId}`);
            } else {
              // Create new customer with normalized phone
              const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                  company_name: companyName,
                  contact_person: contactName,
                  phone: normalizedPhone || email,
                  email: email || null,
                  address: address || null,
                  city: city || null,
                  state: state || null,
                  is_b2b: true,
                  tenant_id: account.tenant_id || null,
                })
                .select()
                .single();

              if (customerError) {
                console.error('Failed to create customer:', customerError);
                continue;
              }

              customerId = newCustomer.id;
              customersCreated++;
              totalCustomersCreated++;
              console.log(`[Customer Created] New customer ${customerId} with phone ${normalizedPhone || email}`);
            }

            // Check for duplicate lead
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('source', 'tradeindia')
              .eq('source_reference', queryId)
              .maybeSingle();

            if (existingLead) {
              console.log(`Lead ${queryId} already exists, skipping`);
              continue;
            }

            // DEDUPE: Merge repeat enquiries from the same buyer on the same product
            // (different TradeIndia enquiry ids) into a single OPEN lead from the last 24h.
            const productKey = extractProductKey(productName || subject);
            const repeatOf = await findOpenRecentLead(supabase, {
              source: 'tradeindia',
              tenantId: account.tenant_id || null,
              customerId,
              productKey,
            });
            if (repeatOf) {
              await supabase.from('activities').insert({
                lead_id: repeatOf.id,
                user_id: repeatOf.assigned_to,
                activity_type: 'repeat_enquiry',
                description: message || (productName ? `Product: ${productName}` : subject) || 'Repeat enquiry from TradeIndia',
                metadata: {
                  source: 'tradeindia',
                  source_reference: queryId,
                  product_name: productName || null,
                  received_at: new Date().toISOString(),
                },
              });
              await supabase
                .from('leads')
                .update({ last_activity_at: new Date().toISOString() })
                .eq('id', repeatOf.id);
              console.log(`[Dedupe] Merged TradeIndia enquiry ${queryId} into existing lead ${repeatOf.id}`);
              continue;
            }

            // LQT-FIRST: Insert with assigned_to=null so the DB trigger
            // (auto_assign_lead_on_insert) routes via pick_next_lqt_user(tenant_id).
            const customerQuery = message || (productName ? `Product: ${productName}` : subject);
            const rawLeadTime = lead.generated_date || lead.inquiry_date || lead.query_time || lead.posted_date || lead.created_date || lead.DATE || lead.GENERATED_DATE;

            const { data: newLead, error: leadError } = await supabase
              .from('leads')
              .upsert({
                title: subject,
                customer_id: customerId,
                source: 'tradeindia',
                source_reference: queryId,
                customer_query: customerQuery,
                assigned_to: null,
                office_id: lucknowOfficeId,
                status: 'new',
                tenant_id: account.tenant_id || null,
                created_at: parseTradeIndiaTime(rawLeadTime),
              }, {
                onConflict: 'source,source_reference',
                ignoreDuplicates: true
              })
              .select('id')
              .maybeSingle();

            if (leadError) {
              console.error('Failed to create lead:', leadError);
              continue;
            }

            // If no data returned, it was a duplicate that was ignored
            if (!newLead) {
              console.log(`Lead ${queryId} is a duplicate (caught by DB constraint), skipped`);
              continue;
            }

            leadsCreated++;
            totalLeadsCreated++;
            console.log(`Created lead ${newLead.id} for query ${queryId}`);

          } catch (err) {
            console.error('Error processing lead:', err);
          }
        }

        totalFetched += leads.length;

        await supabase
          .from('integration_accounts')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', account.id);

        if (logEntry) {
          await supabase
            .from('integration_logs')
            .update({
              status: 'success',
              leads_synced: leadsCreated,
              metadata: {
                ...logEntry.metadata,
                completed_at: new Date().toISOString(),
                leads_fetched: leads.length,
                leads_created: leadsCreated,
                customers_created: customersCreated,
              }
            })
            .eq('id', logEntry.id);
        }

        accountResults.push({
          account: account.account_name,
          leads_synced: leadsCreated,
        });

      } catch (err) {
        console.error(`Error processing account ${account.account_name}:`, err);
        
        if (logEntry) {
          await supabase
            .from('integration_logs')
            .update({
              status: 'error',
              error_message: err instanceof Error ? err.message : 'Unknown error',
              metadata: { ...logEntry.metadata, error: String(err) }
            })
            .eq('id', logEntry.id);
        }

        accountResults.push({
          account: account.account_name,
          leads_synced: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await supabase
      .from('integration_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('integration_type', 'tradeindia');

    return new Response(JSON.stringify({
      success: true,
      total_leads_synced: totalLeadsCreated,
      total_customers_created: totalCustomersCreated,
      total_fetched: totalFetched,
      accounts: accountResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in tradeindia-leads function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
