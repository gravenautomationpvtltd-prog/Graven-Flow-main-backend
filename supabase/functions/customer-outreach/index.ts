import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string;
  assigned_sales_id: string | null;
  outreach_opted_out: boolean | null;
}

interface SalesPerson {
  id: string;
  full_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { 
      batchSize = 50, 
      channels = ['email', 'whatsapp'],
      daysGap = 30,
      testMode = false,
      testCustomerId = null,
      whatsappCampaignName = null,
    } = body;

    console.log(`Starting customer outreach: batchSize=${batchSize}, channels=${channels.join(',')}, daysGap=${daysGap}, testMode=${testMode}, whatsappCampaignName=${whatsappCampaignName}`);

    // Get active templates
    const { data: templates, error: templatesError } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError || !templates?.length) {
      console.error('No active templates found:', templatesError);
      return new Response(JSON.stringify({ 
        error: 'No active outreach templates found' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailTemplate = templates.find(t => t.channel === 'email');
    const whatsappTemplate = templates.find(t => t.channel === 'whatsapp');

    // Get customers to contact
    let customersQuery = supabase
      .from('customers')
      .select('id, company_name, contact_person, email, phone, assigned_sales_id, outreach_opted_out')
      .eq('outreach_opted_out', false)
      .not('assigned_sales_id', 'is', null);

    if (testMode && testCustomerId) {
      customersQuery = customersQuery.eq('id', testCustomerId);
    } else {
      // Exclude customers already contacted in the last X days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysGap);
      
      // Get IDs of customers already contacted recently
      const { data: recentOutreach } = await supabase
        .from('customer_outreach')
        .select('customer_id')
        .gte('campaign_date', cutoffDate.toISOString().split('T')[0]);

      const recentlyContactedIds = recentOutreach?.map(o => o.customer_id) || [];
      
      if (recentlyContactedIds.length > 0) {
        customersQuery = customersQuery.not('id', 'in', `(${recentlyContactedIds.join(',')})`);
      }

      customersQuery = customersQuery.limit(batchSize);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw new Error('Failed to fetch customers');
    }

    if (!customers?.length) {
      console.log('No customers to contact');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No customers to contact at this time',
        stats: { sent: 0, failed: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${customers.length} customers to contact`);

    // Get salesperson names for personalization
    const salesIds = [...new Set(customers.map(c => c.assigned_sales_id).filter(Boolean))];
    const { data: salespeople } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', salesIds);

    const salespersonMap: Record<string, string> = {};
    salespeople?.forEach((sp: SalesPerson) => {
      salespersonMap[sp.id] = sp.full_name;
    });

    // Get WhatsApp settings if needed
    let whatsappSettings = null;
    if (channels.includes('whatsapp')) {
      const { data: settings } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('integration_type', 'whatsapp')
        .eq('is_enabled', true)
        .single();
      whatsappSettings = settings;
    }

    const stats = { emailSent: 0, whatsappSent: 0, failed: 0 };
    const results: { customerId: string; status: string; error?: string }[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const customer of customers as Customer[]) {
      const customerName = customer.contact_person || customer.company_name;
      const salespersonName = customer.assigned_sales_id ? salespersonMap[customer.assigned_sales_id] : 'Our Team';
      
      let emailSentAt = null;
      let whatsappSentAt = null;
      let emailId = null;
      let errorMessage = null;

      try {
        // Send Email
        if (channels.includes('email') && customer.email && emailTemplate && RESEND_API_KEY) {
          const personalizedSubject = emailTemplate.subject
            ?.replace(/\{\{customer_name\}\}/g, customerName)
            .replace(/\{\{salesperson_name\}\}/g, salespersonName);

          const personalizedBody = emailTemplate.body
            .replace(/\{\{customer_name\}\}/g, customerName)
            .replace(/\{\{salesperson_name\}\}/g, salespersonName);

          // Use unique reply-to with customer ID for tracking replies
          const replyToEmail = `enquiry+${customer.id}@reply.graven.co`;

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Graven Automation <noreply@graven.co>',
              to: [customer.email],
              reply_to: replyToEmail,
              subject: personalizedSubject || 'Enquiry Request - Graven Automation',
              html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
                ${personalizedBody.replace(/\n/g, '<br>')}
              </div>`,
            }),
          });

          const emailResult = await emailResponse.json();

          if (emailResponse.ok && emailResult.id) {
            emailSentAt = new Date().toISOString();
            emailId = emailResult.id;
            stats.emailSent++;
            console.log(`Email sent to ${customer.email} (ID: ${emailId})`);
          }
        }

        // Send WhatsApp
        if (channels.includes('whatsapp') && customer.phone && whatsappTemplate && whatsappSettings) {
          const provider = whatsappSettings.config?.provider || '360dialog';
          const cleanPhone = customer.phone.replace(/\D/g, '');
          const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

          const personalizedMessage = whatsappTemplate.body
            .replace(/\{\{customer_name\}\}/g, customerName)
            .replace(/\{\{salesperson_name\}\}/g, salespersonName);

          let whatsappResponse: Response | null = null;

          if (provider === 'aisensy') {
            // Use the selected template campaign name, or fallback to template setting, or default
            const campaignNameToUse = whatsappCampaignName || whatsappTemplate.whatsapp_template_name || 'marketing_english_19_12_2025_5726';
            console.log(`Using WhatsApp campaign: ${campaignNameToUse}`);
            
            whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiKey: whatsappSettings.api_key,
                campaignName: campaignNameToUse,
                destination: phoneWithCountry,
                userName: customerName,
                templateParams: [customerName],
                source: 'CRM_Outreach',
              })
            });

            // Log AiSensy response for debugging
            const aisensyResult = await whatsappResponse.json();
            console.log(`AiSensy response for ${phoneWithCountry}:`, JSON.stringify(aisensyResult));
            
            if (aisensyResult.success || aisensyResult.status === 'success') {
              whatsappSentAt = new Date().toISOString();
              stats.whatsappSent++;
              console.log(`WhatsApp sent to ${phoneWithCountry}`);
            } else {
              console.error(`AiSensy failed for ${phoneWithCountry}:`, aisensyResult);
              errorMessage = aisensyResult.message || aisensyResult.error || 'AiSensy API error';
            }
          } else if (provider === '360dialog') {
            whatsappResponse = await fetch('https://waba.360dialog.io/v1/messages', {
              method: 'POST',
              headers: {
                'D360-API-KEY': whatsappSettings.api_key,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: phoneWithCountry,
                type: 'text',
                text: { body: personalizedMessage }
              })
            });

            if (whatsappResponse?.ok) {
              whatsappSentAt = new Date().toISOString();
              stats.whatsappSent++;
              console.log(`WhatsApp sent to ${phoneWithCountry}`);
            }
          }
        }

        // Create outreach record
        await supabase
          .from('customer_outreach')
          .insert({
            customer_id: customer.id,
            campaign_date: today,
            email_sent_at: emailSentAt,
            whatsapp_sent_at: whatsappSentAt,
            email_id: emailId,
            status: emailSentAt || whatsappSentAt ? 'sent' : 'failed',
            error_message: errorMessage,
          });

        results.push({ 
          customerId: customer.id, 
          status: emailSentAt || whatsappSentAt ? 'sent' : 'skipped' 
        });

      } catch (error) {
        console.error(`Error sending to customer ${customer.id}:`, error);
        stats.failed++;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await supabase
          .from('customer_outreach')
          .insert({
            customer_id: customer.id,
            campaign_date: today,
            status: 'failed',
            error_message: errorMessage,
          });

        results.push({ 
          customerId: customer.id, 
          status: 'failed', 
          error: errorMessage 
        });
      }
    }

    // Log the outreach run
    await supabase
      .from('integration_logs')
      .insert({
        integration_type: 'whatsapp',
        status: 'success',
        metadata: {
          action: 'customer_outreach',
          customers_processed: customers.length,
          emails_sent: stats.emailSent,
          whatsapp_sent: stats.whatsappSent,
          failed: stats.failed,
          test_mode: testMode,
        }
      });

    console.log(`Outreach complete: ${stats.emailSent} emails, ${stats.whatsappSent} WhatsApp, ${stats.failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Outreach complete`,
      stats: {
        customersProcessed: customers.length,
        emailsSent: stats.emailSent,
        whatsappSent: stats.whatsappSent,
        failed: stats.failed,
      },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in customer-outreach function:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
