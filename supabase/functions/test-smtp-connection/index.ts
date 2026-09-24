import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSmtpRequest {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: 'tls' | 'ssl' | 'none';
  test_email: string;
  sender_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      smtp_host, smtp_port, smtp_username, smtp_password,
      smtp_encryption, test_email, sender_name
    }: TestSmtpRequest = await req.json();

    if (!smtp_host || !smtp_port || !smtp_username || !smtp_password || !test_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required SMTP configuration fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Testing SMTP connection: ${smtp_host}:${smtp_port} (${smtp_encryption})`);

    const client = new SMTPClient({
      connection: {
        hostname: smtp_host,
        port: smtp_port,
        tls: smtp_encryption === 'ssl',
        auth: {
          username: smtp_username,
          password: smtp_password,
        },
      },
    });

    const fromAddress = sender_name
      ? `${sender_name} <${smtp_username}>`
      : smtp_username;

    await client.send({
      from: fromAddress,
      to: test_email,
      subject: "SMTP Test - Connection Successful ✓",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">✓ SMTP Connection Successful</h2>
          </div>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #bbf7d0;">
            <p><strong>Server:</strong> ${smtp_host}:${smtp_port}</p>
            <p><strong>Encryption:</strong> ${smtp_encryption.toUpperCase()}</p>
            <p><strong>Username:</strong> ${smtp_username}</p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This is a test email to verify your SMTP configuration is working correctly.
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    console.log("SMTP test successful");

    return new Response(
      JSON.stringify({ success: true, message: "Test email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("SMTP test failed:", error);

    let friendlyError = error.message || "Connection failed";
    if (friendlyError.includes("ECONNREFUSED")) {
      friendlyError = "Connection refused. Check host and port.";
    } else if (friendlyError.includes("auth") || friendlyError.includes("535")) {
      friendlyError = "Authentication failed. Check username and password.";
    } else if (friendlyError.includes("timeout") || friendlyError.includes("ETIMEDOUT")) {
      friendlyError = "Connection timed out. Check host, port, and encryption settings.";
    }

    return new Response(
      JSON.stringify({ success: false, error: friendlyError }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);