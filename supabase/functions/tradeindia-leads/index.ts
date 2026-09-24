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

        const userid = (account.userid || '').trim();
        const profileId = (account.profile_id || '').trim();
        const apiKey = (account.api_key || '').trim();

        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        
        const fromDateStr = fromDate.toISOString().split('T')[0];
        const toDateStr = toDate.toISOString().split('T')[0];

        const apiUrl = `${baseUrl}?userid=${userid}&profile_id=${profileId}&key=${apiKey}&from_date=${fromDateStr}&to_date=${toDateStr}`;
        
        console.log(`Fetching leads from TradeIndia ${account.account_type} API...`);
        console.log(`API URL (masked): ${baseUrl}?userid=${userid}&profile_id=${profileId}&key=***&from_date=${fromDateStr}&to_date=${toDateStr}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
        });
        
        if (!response.ok) {
          throw new Error(`TradeIndia API returned HTTP status ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html') || (!contentType.includes('application/json') && !contentType.includes('text/plain'))) {
          const htmlContent = await response.text();
          console.error('TradeIndia returned HTML instead of JSON:', htmlContent.substring(0, 500));
          throw new Error('TradeIndia API returned an error page. Please verify your credentials.');
        }
        
        let data;
        const responseText = await response.text();
        
        if (responseText.includes('maintenance') || responseText.includes('undergoing maintenance')) {
          console.log('TradeIndia API is under maintenance');
          throw new Error('TradeIndia API is currently under maintenance. Please try again later.');
        }
        
        try {
          data = JSON.parse(responseText);
          while (typeof data === 'string') {
            console.log('Response was string-encoded, parsing again...');
            data = JSON.parse(data);
          }
        } catch (parseError) {
          console.error('Failed to parse TradeIndia response:', responseText.substring(0, 500));
          throw new Error('TradeIndia API returned invalid JSON.');
        }

        console.log('TradeIndia API Response Keys:', Object.keys(data));
        console.log('Response STATUS:', data.STATUS);
        console.log('Response TOTAL_RECORDS:', data.TOTAL_RECORDS);
        
        if (data.STATUS === 'FAILURE' || data.error) {
          console.error('TradeIndia API error:', data);
          
          if (logEntry) {
            await supabase
              .from('integration_logs')
              .update({
                status: 'error',
                error_message: data.MESSAGE || data.error || 'Failed to fetch leads',
                metadata: { ...logEntry.metadata, error: data }
              })
              .eq('id', logEntry.id);
          }

          accountResults.push({
            account: account.account_name,
            leads_synced: 0,
            error: data.MESSAGE || data.error || 'API error',
          });
          continue;
        }

        let leads: any[] = [];
        
        console.log('Data type:', typeof data, 'Is Array:', Array.isArray(data));
        
        if (Array.isArray(data)) {
          leads = data;
          console.log('Parsed as direct array');
        } else if (typeof data === 'object' && data !== null) {
          const keys = Object.keys(data);
          const hasNumericKeys = keys.length > 0 && keys.some(k => !isNaN(Number(k)) && Number(k) >= 0);
          
          console.log('Keys sample:', keys.slice(0, 5), 'Has numeric keys:', hasNumericKeys);
          
          if (hasNumericKeys && !data.STATUS && !data.error) {
            leads = Object.values(data);
            console.log('Parsed as numeric-keyed object, got', leads.length, 'items');
          } else {
            leads = data.data || data.RESPONSE || data.leads || data.leads_list || data.result || [];
            console.log('Parsed as standard object');
          }
        }
        
        console.log(`Found ${leads.length} leads in response`);
        
        if (leads.length > 0) {
          console.log('First lead structure:', JSON.stringify(leads[0]).substring(0, 500));
        }
        
        let leadsCreated = 0;
        let customersCreated = 0;

        for (const lead of leads) {
          try {
            const rawPhone = lead.sender_mobile || lead.mobile || lead.SENDER_MOBILE;
            const email = lead.sender_email || lead.email || lead.SENDER_EMAIL;
            const companyName = lead.sender_company || lead.company_name || lead.SENDER_COMPANY || 'Unknown Company';
            const contactName = lead.sender_name || lead.contact_name || lead.SENDER_NAME;
            const city = lead.sender_city || lead.city || lead.SENDER_CITY;
            const state = lead.sender_state || lead.state || lead.SENDER_STATE;
            const address = lead.sender_address || lead.address || lead.SENDER_ADDRESS;
            const queryId = lead.rfi_id || lead.query_id || lead.QUERY_ID || `TI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const subject = lead.subject || lead.product_name || lead.SUBJECT || 'TradeIndia Enquiry';
            const message = lead.message || lead.query_message || lead.QUERY_MESSAGE || '';
            const productName = lead.product_name || lead.QUERY_PRODUCT_NAME || '';

            if (!rawPhone && !email) {
              console.log('Skipping lead without contact info');
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
