import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to normalize phone number to last 10 digits
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

// Helper to get Lucknow office ID
async function getLucknowOfficeId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('offices')
    .select('id')
    .eq('location', 'lucknow')
    .single();
  return data?.id || null;
}

// Helper to get default user ID
async function getDefaultUserId(supabase: any): Promise<string> {
  const { data: defaultUser } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['super_admin', 'coo'])
    .limit(1)
    .single();
  return defaultUser?.user_id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification (GET request)
  if (req.method === 'GET') {
    return new Response('Email inbound webhook is active', { 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse inbound email from Resend
    const contentType = req.headers.get('content-type') || '';
    let emailData: any;

    if (contentType.includes('application/json')) {
      emailData = await req.json();
    } else {
      // Handle form data or multipart
      const text = await req.text();
      console.log('Raw webhook payload:', text);
      
      try {
        emailData = JSON.parse(text);
      } catch {
        console.error('Failed to parse email data');
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Received email inbound webhook:', JSON.stringify(emailData));

    // Extract email details
    const from = emailData.from || emailData.sender || '';
    const to = emailData.to || '';
    const subject = emailData.subject || '';
    const textBody = emailData.text || emailData.body || emailData.plain || '';
    const htmlBody = emailData.html || '';

    // Extract customer ID from reply-to address
    // Format: enquiry+{customer_id}@reply.graven.co
    let customerId: string | null = null;
    const toAddresses = Array.isArray(to) ? to : [to];
    
    for (const addr of toAddresses) {
      const match = addr.match(/enquiry\+([a-f0-9-]+)@/i);
      if (match) {
        customerId = match[1];
        break;
      }
    }

    // Also try to extract from email headers or references
    if (!customerId && emailData.headers) {
      const inReplyTo = emailData.headers['in-reply-to'] || '';
      const references = emailData.headers['references'] || '';
      
      // Try to find customer ID in references
      const refMatch = (inReplyTo + ' ' + references).match(/enquiry\+([a-f0-9-]+)@/i);
      if (refMatch) {
        customerId = refMatch[1];
      }
    }

    // Extract sender email
    const senderEmail = typeof from === 'string' 
      ? from.match(/<([^>]+)>/)?.[1] || from 
      : from?.address || from?.email || '';

    console.log(`Processing email from: ${senderEmail}, customerId: ${customerId}, subject: ${subject}`);

    let customer: any = null;

    // Try to find customer by ID first
    if (customerId) {
      const { data } = await supabase
        .from('customers')
        .select('*, assigned_sales:profiles!customers_assigned_sales_id_fkey(id, full_name, email)')
        .eq('id', customerId)
        .single();
      customer = data;
    }

    // If not found by ID, try by email
    if (!customer && senderEmail) {
      const { data } = await supabase
        .from('customers')
        .select('*, assigned_sales:profiles!customers_assigned_sales_id_fkey(id, full_name, email)')
        .eq('email', senderEmail)
        .single();
      customer = data;
    }

    // If still not found, try by phone in the email content
    if (!customer) {
      const phoneMatch = (textBody + ' ' + subject).match(/\b\d{10}\b/);
      if (phoneMatch) {
        const normalizedPhone = normalizePhone(phoneMatch[0]);
        const { data } = await supabase
          .from('customers')
          .select('*, assigned_sales:profiles!customers_assigned_sales_id_fkey(id, full_name, email)')
          .or(`phone.ilike.%${normalizedPhone}%,alternate_phone.ilike.%${normalizedPhone}%`)
          .limit(1)
          .single();
        customer = data;
      }
    }

    if (!customer) {
      console.log('Could not identify customer from email');
      
      // Log the unidentified email
      await supabase
        .from('integration_logs')
        .insert({
          integration_type: 'whatsapp', // Using existing type
          status: 'failed',
          error_message: 'Could not identify customer from email reply',
          metadata: {
            action: 'email_inbound',
            sender: senderEmail,
            subject: subject,
            customer_id_attempted: customerId,
          }
        });

      return new Response(JSON.stringify({ 
        success: false,
        error: 'Could not identify customer' 
      }), {
        status: 200, // Return 200 to prevent webhook retry
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found customer: ${customer.company_name} (${customer.id})`);

    // Determine assigned user (customer loyalty)
    const assignedTo = customer.assigned_sales_id || await getDefaultUserId(supabase);
    const lucknowOfficeId = await getLucknowOfficeId(supabase);
    const officeId = customer.office_id || lucknowOfficeId;

    // Check if there's an existing active lead for this customer
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('customer_id', customer.id)
      .in('status', ['new', 'contacted', 'engaged', 'qualified', 'proposal', 'quoted', 'negotiation'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingLead) {
      console.log(`Found existing active lead ${existingLead.id}, logging activity`);
      
      // Log activity on existing lead
      await supabase
        .from('activities')
        .insert({
          lead_id: existingLead.id,
          user_id: assignedTo,
          activity_type: 'email_received',
          description: `Email reply received: ${subject}`,
          metadata: {
            sender: senderEmail,
            subject: subject,
            body_preview: textBody.substring(0, 500),
            source: 'email_outreach_reply',
          }
        });

      // Update lead's last_activity_at
      await supabase
        .from('leads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', existingLead.id);

      // Update outreach record if exists
      await supabase
        .from('customer_outreach')
        .update({
          email_response_at: new Date().toISOString(),
          lead_id: existingLead.id,
          status: 'responded',
        })
        .eq('customer_id', customer.id)
        .is('email_response_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ 
        success: true,
        action: 'activity_logged',
        lead_id: existingLead.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new lead from email reply
    console.log(`Creating new lead for customer ${customer.company_name}, assigned to ${assignedTo}`);

    const leadTitle = subject || `Email Enquiry from ${customer.company_name}`;
    const customerQuery = textBody.substring(0, 2000); // Limit query length

    // LQT-FIRST: Insert with assigned_to=null so the DB trigger routes via
    // pick_next_lqt_user(tenant_id). External email-reply leads must land in LQT.
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        title: leadTitle,
        customer_id: customer.id,
        assigned_to: null,
        office_id: officeId,
        source: 'manual',
        source_reference: `email:${senderEmail}`,
        customer_query: customerQuery,
        status: 'new',
        last_activity_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error creating lead:', leadError);
      throw new Error(`Failed to create lead: ${leadError.message}`);
    }

    console.log(`Created lead ${newLead.id}`);

    // Log initial activity (use trigger-assigned user when available)
    await supabase
      .from('activities')
      .insert({
        lead_id: newLead.id,
        user_id: newLead.assigned_to || assignedTo,
        activity_type: 'lead_created',
        description: `Lead created from email reply: ${subject}`,
        metadata: {
          sender: senderEmail,
          subject: subject,
          body_preview: textBody.substring(0, 500),
          source: 'email_outreach_reply',
        }
      });

    // Update outreach record if exists
    await supabase
      .from('customer_outreach')
      .update({
        email_response_at: new Date().toISOString(),
        lead_id: newLead.id,
        status: 'responded',
      })
      .eq('customer_id', customer.id)
      .is('email_response_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    // Log successful processing
    await supabase
      .from('integration_logs')
      .insert({
        integration_type: 'whatsapp',
        status: 'success',
        leads_synced: 1,
        metadata: {
          action: 'email_inbound_lead_created',
          lead_id: newLead.id,
          customer_id: customer.id,
          sender: senderEmail,
          subject: subject,
        }
      });

    console.log('Email inbound processing complete');

    return new Response(JSON.stringify({
      success: true,
      action: 'lead_created',
      lead_id: newLead.id,
      customer_id: customer.id,
      assigned_to: assignedTo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in email-inbound-webhook:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 200, // Return 200 to prevent excessive retries
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
