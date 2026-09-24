import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getTenantEmailConfig, buildFromAddress } from "../_shared/tenant-email-config.ts";
import { sendEmail } from "../_shared/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DocumentInfo {
  name: string;
  url: string;
  type: string;
}

interface SendDispatchEmailRequest {
  recipientEmail: string;
  ccEmails?: string[];
  subject: string;
  message: string;
  dispatchNumber: string;
  documents: DocumentInfo[];
  tenant_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipientEmail,
      ccEmails,
      subject,
      message,
      dispatchNumber,
      documents,
      tenant_id,
    }: SendDispatchEmailRequest = await req.json();

    // Fetch tenant email config
    const emailConfig = await getTenantEmailConfig(tenant_id);

    console.log(`Sending dispatch email for ${dispatchNumber} to ${recipientEmail}`);
    console.log(`Documents to attach: ${documents.length}`);

    // Fetch documents and convert to attachments
    const attachments = [];
    for (const doc of documents) {
      try {
        const response = await fetch(doc.url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Content = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuffer))
          );
          
          // Determine content type
          let contentType = 'application/pdf';
          if (doc.name.toLowerCase().endsWith('.jpg') || doc.name.toLowerCase().endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          } else if (doc.name.toLowerCase().endsWith('.png')) {
            contentType = 'image/png';
          }

          attachments.push({
            filename: doc.name,
            content: base64Content,
          });
          console.log(`Attached: ${doc.name}`);
        } else {
          console.error(`Failed to fetch document: ${doc.name}, status: ${response.status}`);
        }
      } catch (fetchError) {
        console.error(`Error fetching document ${doc.name}:`, fetchError);
      }
    }

    // Build email HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .header h2 { margin: 0; color: #333; }
          .content { white-space: pre-wrap; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .documents { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .documents h4 { margin: 0 0 10px 0; }
          .documents ul { margin: 0; padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Dispatch Documents - ${dispatchNumber}</h2>
          </div>
          <div class="content">${message.replace(/\n/g, '<br>')}</div>
          ${attachments.length > 0 ? `
          <div class="documents">
            <h4>Attached Documents (${attachments.length}):</h4>
            <ul>
              ${attachments.map(a => `<li>${a.filename}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          <div class="footer">
            <p>This email was sent from ${emailConfig.companyName} CRM</p>
            <p>© ${new Date().getFullYear()} ${emailConfig.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via unified sendEmail
    const result = await sendEmail(tenant_id, {
      from: buildFromAddress(emailConfig, 'dispatch'),
      to: [recipientEmail],
      replyTo: emailConfig.replyTo,
      subject: subject,
      html: htmlContent,
      cc: ccEmails?.length ? ccEmails : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-dispatch-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
