import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'optout', 'opt-out'];

// Normalize phone number to last 10 digits (Indian mobile format)
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
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
  lucknowOfficeId: string
): Promise<string | null> {
  // PRIORITY 1: Customer Loyalty
  if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('assigned_sales_id, state')
      .eq('id', customerId)
      .single();

    if (customer?.assigned_sales_id) {
      console.log(`[Customer Loyalty] Assigning to existing salesperson: ${customer.assigned_sales_id}`);
      return customer.assigned_sales_id;
    }
    if (!customerState && customer?.state) {
      customerState = customer.state;
    }
  }

  // PRIORITY 2: State-based assignment rules
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
            console.log(`[State Rule] Matched: ${rule.rule_name}`);
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

async function getDefaultUserId(supabase: any): Promise<string> {
  const { data: adminUser } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['super_admin', 'coo'])
    .limit(1)
    .maybeSingle();
  
  return adminUser?.user_id || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe') {
      console.log('Webhook verification request received');
      return new Response(challenge, { status: 200 });
    }

    return new Response('OK', { status: 200 });
  }

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
      .eq('integration_type', 'whatsapp')
      .single();

    if (settingsError || !settings?.is_enabled) {
      console.log('WhatsApp integration not enabled');
      return new Response(JSON.stringify({ error: 'Integration not enabled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('Received WhatsApp webhook:', JSON.stringify(body));

    const provider = settings.config?.provider || '360dialog';
    let messages: any[] = [];

    if (provider === '360dialog') {
      messages = body.messages || [];
    } else if (provider === 'gupshup') {
      if (body.type === 'message') {
        messages = [{
          from: body.payload?.sender?.phone,
          text: { body: body.payload?.payload?.text || body.payload?.payload?.caption },
          timestamp: body.timestamp,
          type: body.payload?.type,
        }];
      }
    } else if (provider === 'wati') {
      if (body.waId && body.text) {
        messages = [{
          from: body.waId,
          text: { body: body.text },
          timestamp: body.timestamp,
          type: 'text',
        }];
      }
    } else if (provider === 'aisensy') {
      if (body.waId && body.text) {
        messages = [{
          from: body.waId,
          text: { body: body.text },
          timestamp: body.timestamp,
          type: body.type || 'text',
        }];
      } else if (body.from && body.message) {
        messages = [{
          from: body.from,
          text: { body: body.message },
          timestamp: body.timestamp,
          type: body.type || 'text',
        }];
      } else if (body.payload?.from && body.payload?.text) {
        messages = [{
          from: body.payload.from,
          text: { body: body.payload.text },
          timestamp: body.payload.timestamp,
          type: body.payload.type || 'text',
        }];
      }
    }

    let leadsCreated = 0;
    let activitiesLogged = 0;

    for (const message of messages) {
      try {
        const rawPhone = message.from;
        const normalizedPhone = normalizePhone(rawPhone);
        const messageText = message.text?.body || message.caption || '';
        
        if (!normalizedPhone || normalizedPhone.length !== 10 || !messageText) continue;

        const isOptOut = OPT_OUT_KEYWORDS.some(keyword => 
          messageText.toLowerCase().trim() === keyword
        );

        // Find customer using normalized phone pattern matching
        let customerId: string | null = null;
        let existingCustomer: any = null;
        let customerName = message.profile?.name || 'WhatsApp User';

        const { data: existingCustomerData } = await supabase
          .from('customers')
          .select('id, assigned_sales_id, notes')
          .or(`phone.like.%${normalizedPhone},alternate_phone.like.%${normalizedPhone}`)
          .limit(1)
          .maybeSingle();

        existingCustomer = existingCustomerData;

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log(`[Customer Found] Matched existing customer ${customerId} by phone pattern %${normalizedPhone}`);

          if (isOptOut) {
            await supabase
              .from('customers')
              .update({
                notes: `${existingCustomer.notes || ''}\n[${new Date().toISOString()}] Customer opted out of WhatsApp outreach.`
              })
              .eq('id', existingCustomer.id);

            console.log(`Customer ${normalizedPhone} opted out of WhatsApp outreach`);
            continue;
          }
        } else {
          // Create new customer with normalized phone
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              company_name: customerName,
              contact_person: customerName,
              phone: normalizedPhone,
              is_b2b: false,
            })
            .select()
            .single();

          if (customerError) {
            console.error('Failed to create customer:', customerError);
            continue;
          }

          customerId = newCustomer.id;
          console.log(`[Customer Created] New customer ${customerId} with phone ${normalizedPhone}`);
        }

        // Check if there's an active lead for this customer
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, assigned_to')
          .eq('customer_id', customerId)
          .not('status', 'in', '("won","lost")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingLead) {
          const { error: activityError } = await supabase
            .from('activities')
            .insert({
              lead_id: existingLead.id,
              user_id: existingLead.assigned_to || (await getDefaultUserId(supabase)),
              activity_type: 'whatsapp_received',
              description: messageText,
              metadata: {
                phone: normalizedPhone,
                timestamp: message.timestamp,
                message_type: message.type,
              }
            });

          if (!activityError) {
            activitiesLogged++;
          }

          await supabase
            .from('leads')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', existingLead.id);

        } else {
          // LQT-FIRST: Insert with assigned_to=null so the DB trigger routes via
          // pick_next_lqt_user(tenant_id). External WhatsApp leads land in LQT.
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              title: `WhatsApp Enquiry from ${customerName}`,
              customer_id: customerId,
              source: 'whatsapp',
              source_reference: normalizedPhone,
              customer_query: messageText,
              assigned_to: null,
              office_id: lucknowOfficeId,
              status: 'new',
            })
            .select()
            .single();
          const assignedTo = newLead?.assigned_to || null;

          if (leadError) {
            console.error('Failed to create lead:', leadError);
            continue;
          }

          await supabase
            .from('activities')
            .insert({
              lead_id: newLead.id,
              user_id: assignedTo || (await getDefaultUserId(supabase)),
              activity_type: 'whatsapp_received',
              description: messageText,
              metadata: {
                phone: normalizedPhone,
                timestamp: message.timestamp,
                is_initial_contact: true,
              }
            });

          leadsCreated++;
        }

      } catch (err) {
        console.error('Error processing WhatsApp message:', err);
      }
    }

    await supabase
      .from('integration_logs')
      .insert({
        integration_type: 'whatsapp',
        status: 'success',
        leads_synced: leadsCreated,
        metadata: {
          messages_processed: messages.length,
          activities_logged: activitiesLogged,
          provider: settings.config?.provider,
        }
      });

    await supabase
      .from('integration_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('integration_type', 'whatsapp');

    return new Response(JSON.stringify({
      success: true,
      leads_created: leadsCreated,
      activities_logged: activitiesLogged,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in whatsapp-webhook function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
