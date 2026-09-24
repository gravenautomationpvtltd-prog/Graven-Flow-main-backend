import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  customer_id: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
  cc?: string[];
  user_id?: string;
  tenant_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customer_id, customer_email, customer_name, subject, body, cc, user_id, tenant_id }: RequestBody = await req.json();

    if (!customer_id || !customer_email || !subject || !body) {
      throw new Error("Missing required fields: customer_id, customer_email, subject, body");
    }

    // Fetch tenant email config
    const emailConfig = await getTenantEmailConfig(tenant_id);

    // Send email via unified sendEmail
    const validCc = cc?.filter((email: string) => email.trim()) || [];

    const emailData = await sendEmail(tenant_id, {
      from: buildFromAddress(emailConfig, 'enquiry'),
      to: [customer_email],
      replyTo: emailConfig.replyTo,
      subject: subject,
      html: body.replace(/\n/g, "<br>"),
      cc: validCc.length > 0 ? validCc : undefined,
    });

    if (!emailData.success) {
      throw new Error(emailData.error || "Failed to send email");
    }

    console.log("Enquiry email sent:", emailData);

    // Record in customer_outreach table
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Check if there's an existing outreach record for today
    const { data: existingOutreach } = await supabase
      .from('customer_outreach')
      .select('id')
      .eq('customer_id', customer_id)
      .eq('campaign_date', today)
      .single();

    if (existingOutreach) {
      // Update existing record
      await supabase
        .from('customer_outreach')
        .update({
          email_sent_at: now,
          email_id: emailData.messageId || 'unknown',
          status: 'sent',
          updated_at: now,
          sent_by_user_id: user_id || null,
        })
        .eq('id', existingOutreach.id);
    } else {
      // Create new record
      await supabase
        .from('customer_outreach')
        .insert({
          customer_id: customer_id,
          campaign_date: today,
          email_sent_at: now,
          email_id: emailData.messageId || 'unknown',
          status: 'sent',
          sent_by_user_id: user_id || null,
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailData.messageId,
        message: "Email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-enquiry-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
