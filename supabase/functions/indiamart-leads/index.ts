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

// Extract a stable "product key" from an IndiaMART product name.
// Prefers the first alphanumeric/dash token of length >= 4 that mixes letters and digits
// (typically the SKU/HSN-like code, e.g. "6SE6440-2UD31-8DA1").
// Falls back to the lowercased trimmed name.
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

// Look up an existing OPEN lead for the same customer+source+product within the last 24h.
// Used to merge repeat IndiaMART enquiries (interest + product-view etc.) into one lead.
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

// Get Lucknow office ID
async function getLucknowOfficeId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('offices')
    .select('id')
    .eq('location', 'lucknow')
    .single();
  return data?.id || null;
}

// Get configurable assignable roles from lead_config
async function getAssignableRoles(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('integration_type', 'lead_config')
    .single();
  
  const config = data?.config as { assignable_roles?: string[] } | null;
  return config?.assignable_roles || ['sales'];
}

// Get Lucknow users for round-robin based on configured roles
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

// Check if user is on approved leave today
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

// Get next user in true round-robin with holiday skip
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

// Assign lead with priority: customer loyalty → location rules → round-robin
async function assignLead(
  supabase: any,
  customerId: string | null,
  customerState: string | null,
  customerCity: string | null,
  lucknowOfficeId: string
): Promise<string | null> {
  // PRIORITY 1: Customer Loyalty (if customer has assigned sales, use that)
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

  // PRIORITY 3: Round-robin among Lucknow assignable users
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

  let requestBody: { source?: string; account_id?: string; force?: boolean; recovery_hours?: number } = {};
  try {
    const clonedReq = req.clone();
    requestBody = await clonedReq.json();
  } catch {
    // No body or invalid JSON
  }

  const isScheduledSync = requestBody.source === 'cron';
  const specificAccountId = requestBody.account_id;
  const forceSync = requestBody.force === true;
  const recoveryHours = requestBody.recovery_hours || 0;
  
  console.log(`IndiaMART sync triggered - Source: ${isScheduledSync ? 'cron' : 'manual'}${specificAccountId ? `, Account: ${specificAccountId}` : ''}${forceSync ? ' (forced)' : ''}${recoveryHours > 0 ? ` (recovery: ${recoveryHours}h)` : ''}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // RATE LIMIT PROTECTION: IndiaMART allows only 1 request per 5 minutes
    // Skip if last sync was less than 4 minutes ago (unless forced or manual)
    if (isScheduledSync && !forceSync) {
      const { data: settings } = await supabase
        .from('integration_settings')
        .select('last_sync_at')
        .eq('integration_type', 'indiamart')
        .single();
      
      if (settings?.last_sync_at) {
        const lastSync = new Date(settings.last_sync_at);
        const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        
        if (minutesSinceLastSync < 4) {
          console.log(`Rate limit protection: Only ${minutesSinceLastSync.toFixed(1)} minutes since last sync. Skipping to avoid 429 error.`);
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Skipped - rate limit protection',
            minutes_since_last_sync: minutesSinceLastSync.toFixed(1)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

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
      .eq('integration_type', 'indiamart')
      .single();

    if (settingsError || !settings) {
      console.error('Failed to fetch IndiaMART settings:', settingsError);
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

    const hasNewAccounts = accounts && accounts.length > 0;
    
    if (!hasNewAccounts && !settings.api_key) {
      return new Response(JSON.stringify({ error: 'No accounts configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accountsToProcess = hasNewAccounts
      ? accounts
      : [{ 
          id: 'legacy', 
          account_name: 'Default Account', 
          api_key: settings.api_key,
          account_type: 'crm',
          tenant_id: settings.tenant_id || null,
        }];

    let totalLeadsCreated = 0;
    let totalCustomersCreated = 0;
    let totalFetched = 0;
    const accountResults: Array<{ account: string; leads_synced: number; error?: string }> = [];

    for (const account of accountsToProcess) {
      console.log(`Processing account: ${account.account_name}`);

      const { data: logEntry, error: logError } = await supabase
        .from('integration_logs')
        .insert({
          integration_type: 'indiamart',
          status: 'pending',
          tenant_id: account.tenant_id || null,
          metadata: { 
            started_at: new Date().toISOString(),
            account_id: account.id,
            account_name: account.account_name,
          }
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to create log entry:', logError);
      }

      try {
        const endTime = new Date();
        // Use recovery window if specified, otherwise default 35 minutes
        const timeWindowMinutes = recoveryHours > 0 ? recoveryHours * 60 : 35;
        const startTime = new Date(endTime.getTime() - timeWindowMinutes * 60 * 1000);
        
        const formatDateForIM = (date: Date) => {
          const istOffset = 5.5 * 60 * 60 * 1000;
          const istDate = new Date(date.getTime() + istOffset);
          
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const day = String(istDate.getUTCDate()).padStart(2, '0');
          const month = months[istDate.getUTCMonth()];
          const year = istDate.getUTCFullYear();
          const hours = String(istDate.getUTCHours()).padStart(2, '0');
          const mins = String(istDate.getUTCMinutes()).padStart(2, '0');
          const secs = String(istDate.getUTCSeconds()).padStart(2, '0');
          return `${day}-${month}-${year} ${hours}:${mins}:${secs}`;
        };
        
        const startTimeStr = formatDateForIM(startTime);
        const endTimeStr = formatDateForIM(endTime);
        
        const indiamartApiUrl = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${account.api_key}&start_time=${encodeURIComponent(startTimeStr)}&end_time=${encodeURIComponent(endTimeStr)}`;
        
        console.log(`Fetching IndiaMART leads from ${startTimeStr} to ${endTimeStr} (IST)`);
        console.log(`API URL: ${indiamartApiUrl.replace(account.api_key, '***KEY***')}`);
        
        const response = await fetch(indiamartApiUrl);
        const data = await response.json();
        
        console.log(`IndiaMART API response - CODE: ${data.CODE}, leads count: ${data.RESPONSE?.length || 0}`);

        if (data.CODE !== 200 && data.STATUS !== 'SUCCESS') {
          console.error('IndiaMART API error:', data);
          
          if (logEntry) {
            await supabase
              .from('integration_logs')
              .update({
                status: 'error',
                error_message: data.MESSAGE || 'Failed to fetch leads from IndiaMART',
                metadata: { ...logEntry.metadata, error: data }
              })
              .eq('id', logEntry.id);
          }

          accountResults.push({
            account: account.account_name,
            leads_synced: 0,
            error: data.MESSAGE || 'IndiaMART API error',
          });
          continue;
        }

        const leads = data.RESPONSE || [];
        let leadsCreated = 0;
        let customersCreated = 0;

        for (const lead of leads) {
          try {
            const rawPhone = lead.SENDER_MOBILE || lead.SENDER_MOBILE_ALT;
            if (!rawPhone) continue;

            const normalizedPhone = normalizePhone(rawPhone);
            if (normalizedPhone.length !== 10) {
              console.log(`Invalid phone number: ${rawPhone}, skipping`);
              continue;
            }

            let customerId: string | null = null;
            let existingCustomer: any = null;
            const customerState = lead.SENDER_STATE || null;
            const customerCity = lead.SENDER_CITY || null;

            // Look for existing customer using normalized phone (last 10 digits pattern matching)
            const { data: existingCustomerData } = await supabase
              .from('customers')
              .select('id, assigned_sales_id, phone')
              .or(`phone.like.%${normalizedPhone},alternate_phone.like.%${normalizedPhone}`)
              .limit(1)
              .maybeSingle();

            existingCustomer = existingCustomerData;

            if (existingCustomer) {
              customerId = existingCustomer.id;
              console.log(`[Customer Found] Matched existing customer ${customerId} by phone pattern %${normalizedPhone}`);
            } else {
              // Create new customer with normalized phone
              const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                  company_name: lead.SENDER_COMPANY || lead.SENDER_NAME || 'Unknown Company',
                  contact_person: lead.SENDER_NAME,
                  phone: normalizedPhone,
                  alternate_phone: lead.SENDER_MOBILE_ALT ? normalizePhone(lead.SENDER_MOBILE_ALT) : null,
                  email: lead.SENDER_EMAIL || null,
                  address: lead.SENDER_ADDRESS || null,
                  city: customerCity,
                  state: customerState,
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
              console.log(`[Customer Created] New customer ${customerId} with phone ${normalizedPhone}`);
            }

            // Check if lead already exists - use UNIQUE_QUERY_ID with fallbacks
            const queryId = lead.UNIQUE_QUERY_ID || lead.QUERY_ID || lead.ENQ_ID;
            
            // CRITICAL: Skip records without a valid queryId to avoid DB constraint errors
            if (!queryId) {
              console.log(`Skipping lead - no valid query ID found in record:`, JSON.stringify({
                UNIQUE_QUERY_ID: lead.UNIQUE_QUERY_ID,
                QUERY_ID: lead.QUERY_ID,
                ENQ_ID: lead.ENQ_ID,
                SENDER_NAME: lead.SENDER_NAME
              }));
              continue;
            }

            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('source', 'indiamart')
              .eq('source_reference', queryId)
              .maybeSingle();

            if (existingLead) {
              console.log(`Lead ${queryId} already exists, skipping`);
              continue;
            }

            // DEDUPE: Merge repeat enquiries from the same buyer on the same product
            // (different IndiaMART enquiry ids — e.g. "interest" + "product view")
            // into a single OPEN lead created within the last 24 hours.
            const productKey = extractProductKey(lead.QUERY_PRODUCT_NAME);
            const repeatOf = await findOpenRecentLead(supabase, {
              source: 'indiamart',
              tenantId: account.tenant_id || null,
              customerId,
              productKey,
            });

            if (repeatOf) {
              const queryType = lead.QUERY_TYPE || lead.QUERY_TYPE_NAME || null;
              const description =
                lead.QUERY_MESSAGE ||
                lead.QUERY_MCAT_NAME ||
                lead.SUBJECT ||
                'Repeat enquiry from IndiaMART';
              await supabase.from('activities').insert({
                lead_id: repeatOf.id,
                user_id: repeatOf.assigned_to,
                activity_type: 'repeat_enquiry',
                description,
                metadata: {
                  source: 'indiamart',
                  source_reference: queryId,
                  query_type: queryType,
                  product_name: lead.QUERY_PRODUCT_NAME || null,
                  received_at: new Date().toISOString(),
                },
              });
              await supabase
                .from('leads')
                .update({ last_activity_at: new Date().toISOString() })
                .eq('id', repeatOf.id);
              console.log(
                `[Dedupe] Merged IndiaMART enquiry ${queryId} into existing lead ${repeatOf.id}`
              );
              continue;
            }

            // LQT-FIRST: Insert with assigned_to=null so the DB trigger
            // (auto_assign_lead_on_insert) routes via pick_next_lqt_user(tenant_id).
            // External/incoming leads must always land in LQT first.
            const { data: newLead, error: leadError } = await supabase
              .from('leads')
              .insert({
                title: lead.SUBJECT || lead.QUERY_PRODUCT_NAME || 'IndiaMART Enquiry',
                customer_id: customerId,
                source: 'indiamart',
                source_reference: queryId,
                customer_query: lead.QUERY_MESSAGE || lead.QUERY_MCAT_NAME || '',
                assigned_to: null,
                office_id: lucknowOfficeId,
                status: 'new',
                estimated_value: parseFloat(lead.QUERY_PRICE) || null,
                tenant_id: account.tenant_id || null,
              })
              .select('id')
              .single();

            if (leadError) {
              // Check if it's a duplicate error (race condition)
              if (leadError.code === '23505') {
                console.log(`Lead ${queryId} is a duplicate (race condition), skipping`);
                continue;
              }
              console.error('Failed to create lead:', leadError);
              continue;
            }

            if (!newLead) {
              console.log(`Lead ${queryId} creation returned no data, skipping`);
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

        if (account.id !== 'legacy') {
          await supabase
            .from('integration_accounts')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', account.id);
        }

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

    // Update settings last sync time
    await supabase
      .from('integration_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('integration_type', 'indiamart');

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
    console.error('Error in indiamart-leads function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
