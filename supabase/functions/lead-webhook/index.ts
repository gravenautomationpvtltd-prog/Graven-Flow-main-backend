import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_SOURCES = ['justdial', 'tradeindia', 'email', 'website', 'referral', 'manual', 'indiamart'];

// Normalize phone number to last 10 digits (Indian mobile format)
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

interface LeadWebhookPayload {
  source: string;
  source_reference?: string;
  customer: {
    name: string;
    company?: string;
    phone: string;
    alternate_phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
  };
  query: {
    title?: string;
    message: string;
    product?: string;
    quantity?: string;
    estimated_value?: number;
  };
  metadata?: Record<string, any>;
}

interface IndiaMARTWebhookPayload {
  UNIQUE_QUERY_ID: string;
  QUERY_TYPE: string;
  QUERY_TIME: string;
  SENDER_NAME: string;
  SENDER_MOBILE: string;
  SENDER_MOBILE_ALT?: string;
  SENDER_EMAIL?: string;
  SENDER_COMPANY?: string;
  SENDER_ADDRESS?: string;
  SENDER_CITY?: string;
  SENDER_STATE?: string;
  SENDER_PINCODE?: string;
  SENDER_COUNTRY?: string;
  SUBJECT?: string;
  QUERY_MESSAGE?: string;
  QUERY_MCAT_NAME?: string;
  PRODUCT_NAME?: string;
  CALL_DURATION?: string;
  RECEIVER_MOBILE?: string;
}

function isIndiaMARTPayload(body: any): body is IndiaMARTWebhookPayload {
  return body && (
    typeof body.UNIQUE_QUERY_ID === 'string' ||
    typeof body.SENDER_MOBILE === 'string' ||
    typeof body.QUERY_TYPE === 'string'
  );
}

function convertIndiaMARTPayload(imPayload: IndiaMARTWebhookPayload): LeadWebhookPayload {
  const queryMessage = [
    imPayload.QUERY_MESSAGE,
    imPayload.PRODUCT_NAME ? `Product: ${imPayload.PRODUCT_NAME}` : null,
    imPayload.QUERY_MCAT_NAME ? `Category: ${imPayload.QUERY_MCAT_NAME}` : null,
    imPayload.QUERY_TYPE ? `Query Type: ${imPayload.QUERY_TYPE}` : null,
  ].filter(Boolean).join('\n\n');

  return {
    source: 'indiamart',
    source_reference: imPayload.UNIQUE_QUERY_ID,
    customer: {
      name: imPayload.SENDER_NAME || 'Unknown',
      company: imPayload.SENDER_COMPANY,
      phone: imPayload.SENDER_MOBILE,
      alternate_phone: imPayload.SENDER_MOBILE_ALT,
      email: imPayload.SENDER_EMAIL,
      address: imPayload.SENDER_ADDRESS,
      city: imPayload.SENDER_CITY,
      state: imPayload.SENDER_STATE,
    },
    query: {
      title: imPayload.SUBJECT || imPayload.PRODUCT_NAME || 'IndiaMART Enquiry',
      message: queryMessage || 'New enquiry from IndiaMART',
      product: imPayload.PRODUCT_NAME,
    },
    metadata: {
      query_time: imPayload.QUERY_TIME,
      query_type: imPayload.QUERY_TYPE,
      pincode: imPayload.SENDER_PINCODE,
      country: imPayload.SENDER_COUNTRY,
      call_duration: imPayload.CALL_DURATION,
      receiver_mobile: imPayload.RECEIVER_MOBILE,
    },
  };
}

// Helper to update webhook event status
async function updateWebhookEvent(
  supabase: any, 
  eventId: string | null, 
  result: string, 
  error?: string | null,
  leadId?: string | null,
  customerId?: string | null
): Promise<void> {
  if (!eventId) return;
  
  await supabase
    .from('webhook_events')
    .update({
      processing_result: result,
      error_message: error || null,
      lead_id: leadId || null,
      customer_id: customerId || null,
    })
    .eq('id', eventId);
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

  const { data: lucknowUsers } = await supabase
    .from('profiles')
    .select('id')
    .eq('office_id', lucknowOfficeId)
    .eq('is_active', true)
    .neq('lead_assignment_opt_out', true)
    .in('id', userIds)
    .order('id', { ascending: true });

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

// Check if user is currently checked in (active) - not checked out
async function isUserActive(supabase: any, userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('attendance_records')
    .select('check_in_time, check_out_time')
    .eq('user_id', userId)
    .eq('date', today)
    .limit(1)
    .maybeSingle();
  
  // User is active if they have checked in AND have not checked out
  return data && data.check_in_time && !data.check_out_time;
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
    
    // Check if user is on leave
    const onLeave = await isUserOnLeave(supabase, userId);
    if (onLeave) {
      console.log(`Skipping user ${userId} - on leave`);
      continue;
    }
    
    // Check if user is currently active (checked in but not checked out)
    const active = await isUserActive(supabase, userId);
    if (!active) {
      console.log(`Skipping user ${userId} - not checked in or already checked out`);
      continue;
    }
    
    // User is available - assign lead
    await supabase
      .from('round_robin_tracker')
      .upsert({
        office_id: lucknowOfficeId,
        last_assigned_user_id: userId,
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'office_id' });
    
    console.log(`Round-robin assigned to user: ${userId} (active and not on leave)`);
    return userId;
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
          // Check if user has opted out of lead assignment
          const { data: ruleUserProfile } = await supabase
            .from('profiles')
            .select('lead_assignment_opt_out')
            .eq('id', rule.assigned_user_id)
            .single();
          
          if (ruleUserProfile?.lead_assignment_opt_out === true) {
            console.log(`[State Rule] User ${rule.assigned_user_id} matched but opted out, skipping`);
            continue;
          }

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let rawBody: any;
  let webhookEventId: string | null = null;

  try {
    rawBody = await req.json();
    console.log('Received lead webhook (raw):', JSON.stringify(rawBody));

    // Log the webhook event immediately
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .insert({
        source: rawBody?.UNIQUE_QUERY_ID ? 'indiamart' : (rawBody?.source || 'unknown'),
        source_reference: rawBody?.UNIQUE_QUERY_ID || rawBody?.source_reference || null,
        payload: rawBody,
        processing_result: 'pending',
      })
      .select('id')
      .single();
    
    webhookEventId = webhookEvent?.id || null;
    console.log(`Webhook event logged: ${webhookEventId}`);

    const lucknowOfficeId = await getLucknowOfficeId(supabase);
    if (!lucknowOfficeId) {
      console.error('Lucknow office not found');
      await updateWebhookEvent(supabase, webhookEventId, 'failed', 'Lucknow office not configured');
      // Return 200 to prevent webhook retries
      return new Response(JSON.stringify({ success: false, error: 'Lucknow office not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payloadToProcess = rawBody;
    if (rawBody?.CODE && rawBody?.STATUS === 'SUCCESS' && rawBody?.RESPONSE) {
      console.log('Detected IndiaMART nested response format, extracting RESPONSE');
      payloadToProcess = rawBody.RESPONSE;
    }

    let body: LeadWebhookPayload;
    if (isIndiaMARTPayload(payloadToProcess)) {
      console.log('Detected IndiaMART webhook payload format');
      body = convertIndiaMARTPayload(payloadToProcess);
      console.log('Converted to standard format:', JSON.stringify(body));
    } else {
      body = payloadToProcess as LeadWebhookPayload;
    }

    if (!body.source || !body.customer?.phone || !body.query?.message) {
      await updateWebhookEvent(supabase, webhookEventId, 'invalid', 'Missing required fields: source, customer.phone, query.message');
      // Return 200 to prevent webhook retries for invalid data
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing required fields: source, customer.phone, query.message' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const source = body.source.toLowerCase();
    if (!VALID_SOURCES.includes(source)) {
      await updateWebhookEvent(supabase, webhookEventId, 'invalid', `Invalid source: ${source}`);
      return new Response(JSON.stringify({ 
        success: false,
        error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update webhook event with actual source
    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({ source, source_reference: body.source_reference || null })
        .eq('id', webhookEventId);
    }

    const { data: settings } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration_type', source)
      .maybeSingle();

    // Resolve tenant_id: from integration_settings, or fallback to any tenant
    let tenantId: string | null = settings?.tenant_id || null;
    if (!tenantId) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single();
      tenantId = tenantData?.id || null;
      console.log(`Resolved tenant_id from tenants table: ${tenantId}`);
    }

    if (settings && !settings.is_enabled) {
      await updateWebhookEvent(supabase, webhookEventId, 'failed', `${source} integration is not enabled`);
      return new Response(JSON.stringify({ 
        success: false,
        error: `${source} integration is not enabled` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(body.customer.phone);
    if (normalizedPhone.length !== 10) {
      console.log(`Invalid phone number: ${body.customer.phone}`);
      await updateWebhookEvent(supabase, webhookEventId, 'invalid', `Invalid phone number: ${body.customer.phone}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid phone number' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find customer using normalized phone pattern matching
    let customerId: string | null = null;
    let existingCustomer: any = null;

    const { data: existingCustomerData } = await supabase
      .from('customers')
      .select('id, assigned_sales_id')
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
          company_name: body.customer.company || body.customer.name || 'Unknown Company',
          contact_person: body.customer.name,
          phone: normalizedPhone,
          alternate_phone: body.customer.alternate_phone ? normalizePhone(body.customer.alternate_phone) : null,
          email: body.customer.email || null,
          address: body.customer.address || null,
          city: body.customer.city || null,
          state: body.customer.state || null,
          is_b2b: !!body.customer.company,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (customerError) {
        console.error('Failed to create customer:', customerError);
        await updateWebhookEvent(supabase, webhookEventId, 'failed', `Failed to create customer: ${customerError.message}`);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create customer' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      customerId = newCustomer.id;
      console.log(`[Customer Created] New customer ${customerId} with phone ${normalizedPhone}`);
    }

    // Check for duplicate lead
    if (body.source_reference) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('source', source)
        .eq('source_reference', body.source_reference)
        .maybeSingle();

      if (existingLead) {
        await updateWebhookEvent(supabase, webhookEventId, 'duplicate', undefined, existingLead.id, customerId);
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Lead already exists',
          lead_id: existingLead.id,
          is_duplicate: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // LQT-FIRST: Let the DB trigger (auto_assign_lead_on_insert) route via
    // pick_next_lqt_user(tenant_id). External leads always land in LQT first.
    const assignedTo: string | null = null;

    // Build customer query
    let customerQuery = body.query.message;
    if (body.query.product) {
      customerQuery = `Product: ${body.query.product}\n\n${customerQuery}`;
    }
    if (body.query.quantity) {
      customerQuery = `${customerQuery}\n\nQuantity: ${body.query.quantity}`;
    }

    // Create lead using INSERT (we already checked for duplicates above)
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        title: body.query.title || `${source.charAt(0).toUpperCase() + source.slice(1)} Enquiry`,
        customer_id: customerId,
        source: source as any,
        source_reference: body.source_reference || null,
        customer_query: customerQuery,
        assigned_to: null,
        office_id: lucknowOfficeId,
        status: 'new',
        estimated_value: body.query.estimated_value || null,
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (leadError) {
      // Check if it's a duplicate error (race condition with unique constraint)
      if (leadError.code === '23505') {
        console.log(`Lead with source_reference ${body.source_reference} is a duplicate (race condition)`);
        
        // Fetch the existing lead to return
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('source', source)
          .eq('source_reference', body.source_reference)
          .maybeSingle();
        
        await updateWebhookEvent(supabase, webhookEventId, 'duplicate', null, existingLead?.id, customerId);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Lead already exists (duplicate caught by DB constraint)',
          lead_id: existingLead?.id,
          is_duplicate: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.error('Failed to create lead:', leadError);
      await updateWebhookEvent(supabase, webhookEventId, 'failed', `Failed to create lead: ${leadError.message}`);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create lead' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log activity
    if (assignedTo && newLead) {
      await supabase
        .from('activities')
        .insert({
          lead_id: newLead.id,
          user_id: assignedTo,
          activity_type: 'lead_created',
          description: `Lead received from ${source}`,
          metadata: {
            source: source,
            source_reference: body.source_reference,
            webhook_metadata: body.metadata,
          }
        });
    }

    // Log integration sync
    await supabase
      .from('integration_logs')
      .insert({
        integration_type: source as any,
        status: 'success',
        leads_synced: 1,
        metadata: {
          lead_id: newLead?.id,
          customer_id: customerId,
          assigned_to: assignedTo,
          source_reference: body.source_reference,
        }
      });

    // Update webhook event as success
    await updateWebhookEvent(supabase, webhookEventId, 'success', null, newLead?.id, customerId);

    console.log(`Lead created successfully: ${newLead?.id}, assigned to: ${assignedTo}`);

    return new Response(JSON.stringify({
      success: true,
      lead_id: newLead?.id,
      customer_id: customerId,
      assigned_to: assignedTo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in lead-webhook function:', error);
    // Return 200 to prevent webhook retries but log the error
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
