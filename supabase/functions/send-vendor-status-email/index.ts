import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VendorStatusEmailRequest {
  vendorName: string;
  vendorEmail: string;
  contactPerson: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string;
  tenant_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== send-vendor-status-email function invoked ===");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Request body received:", JSON.stringify({
      vendorName: requestBody.vendorName,
      vendorEmail: requestBody.vendorEmail,
      contactPerson: requestBody.contactPerson,
      status: requestBody.status,
      hasRejectionReason: !!requestBody.rejectionReason
    }));

    const { vendorName, vendorEmail, contactPerson, status, rejectionReason, tenant_id }: VendorStatusEmailRequest = requestBody;

    // Fetch tenant email config
    const emailConfig = await getTenantEmailConfig(tenant_id);
    if (!vendorEmail) {
      console.error("No email address provided for vendor");
      return new Response(
        JSON.stringify({ error: "Vendor email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Preparing ${status} email for vendor: ${vendorName} (${vendorEmail})`);

    const isApproved = status === 'approved';
    const subject = isApproved 
      ? `Congratulations! Your Vendor Application is Approved - ${emailConfig.companyName}`
      : `Vendor Application Update - ${emailConfig.companyName}`;

    const approvedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 50%, #fbbf24 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${emailConfig.companyName}</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Vendor Registration Portal</p>
                  </td>
                </tr>
                
                <!-- Success Icon -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center;">
                    <div style="width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto; line-height: 80px;">
                      <span style="font-size: 40px;">✓</span>
                    </div>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <h2 style="color: #16a34a; text-align: center; margin: 0 0 20px 0; font-size: 28px;">Application Approved!</h2>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${contactPerson || 'Valued Partner'},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      We are pleased to inform you that your vendor registration application for <strong>${vendorName}</strong> has been <strong style="color: #16a34a;">approved</strong>.
                    </p>
                    
                    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                      <h3 style="color: #15803d; margin: 0 0 10px 0; font-size: 16px;">What's Next?</h3>
                      <ul style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>You are now an approved vendor with ${emailConfig.companyName}</li>
                        <li>Our procurement team may reach out for future business opportunities</li>
                        <li>Please ensure your contact details are always up to date</li>
                      </ul>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                      Thank you for partnering with us. We look forward to a successful business relationship.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-align: center;">
                      <strong>${emailConfig.companyName}</strong>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                      This is an automated email. Please do not reply directly to this message.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const rejectedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 50%, #fbbf24 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">${emailConfig.companyName}</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Vendor Registration Portal</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #374151; text-align: center; margin: 0 0 20px 0; font-size: 24px;">Application Update</h2>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${contactPerson || 'Valued Partner'},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Thank you for your interest in becoming a vendor with ${emailConfig.companyName}. After reviewing your application for <strong>${vendorName}</strong>, we regret to inform you that we are unable to approve your registration at this time.
                    </p>
                    
                    ${rejectionReason ? `
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                      <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">Reason for Decision:</h3>
                      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                        ${rejectionReason}
                      </p>
                    </div>
                    ` : ''}
                    
                    <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                      <h3 style="color: #0369a1; margin: 0 0 10px 0; font-size: 16px;">You May Reapply</h3>
                      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                        If you believe you can address the concerns mentioned above, you are welcome to submit a new application in the future.
                      </p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                      We appreciate your understanding and thank you for considering ${emailConfig.companyName}.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; text-align: center;">
                      <strong>${emailConfig.companyName}</strong>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                      This is an automated email. Please do not reply directly to this message.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email via unified sendEmail
    console.log("Sending vendor status email...");

    const emailData = await sendEmail(tenant_id, {
      from: buildFromAddress(emailConfig, 'noreply'),
      to: [vendorEmail],
      replyTo: emailConfig.replyTo,
      subject: subject,
      html: isApproved ? approvedHtml : rejectedHtml,
    });

    if (!emailData.success) {
      throw new Error(emailData.error || "Failed to send email");
    }

    console.log("=== Vendor status email sent successfully ===");
    console.log("Message ID:", emailData.messageId);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("=== Error in send-vendor-status-email function ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
