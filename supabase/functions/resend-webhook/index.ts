import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounce?: {
      message: string;
      type: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("resend-webhook function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ResendWebhookPayload = await req.json();
    console.log("Webhook payload:", JSON.stringify(payload));

    const emailId = payload.data?.email_id;
    if (!emailId) {
      console.log("No email_id in payload, skipping");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const eventType = payload.type;
    const now = new Date().toISOString();

    // Map Resend event types to our status and timestamp field
    let updateData: Record<string, any> = {};
    
    switch (eventType) {
      case "email.sent":
        updateData = { status: "sent" };
        break;
      case "email.delivered":
        updateData = { status: "delivered", delivered_at: now };
        break;
      case "email.delivery_delayed":
        updateData = { status: "delayed" };
        break;
      case "email.complained":
        updateData = { status: "complained", complained_at: now };
        break;
      case "email.bounced":
        updateData = { 
          status: "bounced", 
          bounced_at: now,
          error_message: payload.data.bounce?.message || "Email bounced"
        };
        break;
      case "email.opened":
        updateData = { opened_at: now };
        // Only update status if not already bounced/complained
        break;
      case "email.clicked":
        updateData = { clicked_at: now };
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    // Update the email log record
    const { error } = await supabase
      .from("email_logs")
      .update(updateData)
      .eq("email_id", emailId);

    if (error) {
      console.error("Error updating email log:", error);
    } else {
      console.log(`Updated email ${emailId} with event ${eventType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
