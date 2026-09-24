import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface SendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
}

async function getSmtpConfig(tenantId: string): Promise<{ provider: string; smtp?: SmtpConfig }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: settings } = await supabase
    .from('company_settings')
    .select('setting_key, setting_value')
    .eq('tenant_id', tenantId)
    .in('setting_key', [
      'email_provider', 'smtp_host', 'smtp_port',
      'smtp_username', 'smtp_password', 'smtp_encryption'
    ]);

  const get = (key: string): string | null =>
    settings?.find((s: any) => s.setting_key === key)?.setting_value || null;

  const provider = get('email_provider') || 'resend';

  if (provider === 'smtp') {
    const host = get('smtp_host');
    const port = parseInt(get('smtp_port') || '465', 10);
    const username = get('smtp_username');
    const password = get('smtp_password');
    const encryption = (get('smtp_encryption') || 'ssl') as 'tls' | 'ssl' | 'none';

    if (!host || !username || !password) {
      return { provider: 'resend' }; // fallback if incomplete
    }

    return { provider: 'smtp', smtp: { host, port, username, password, encryption } };
  }

  return { provider: 'resend' };
}

async function sendViaSmtp(config: SmtpConfig, payload: SendEmailPayload): Promise<SendEmailResult> {
  try {
    // Parse "Name <email>" format from `from`
    const fromMatch = payload.from.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].trim() : '';
    const fromEmail = fromMatch ? fromMatch[2] : payload.from;

    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: config.encryption === 'ssl',
        auth: {
          username: config.username,
          password: config.password,
        },
      },
    });

    const mailConfig: any = {
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to: payload.to.join(', '),
      subject: payload.subject,
      html: payload.html,
    };

    if (payload.cc?.length) mailConfig.cc = payload.cc.join(', ');
    if (payload.bcc?.length) mailConfig.bcc = payload.bcc.join(', ');
    if (payload.replyTo) mailConfig.replyTo = payload.replyTo;

    // Handle attachments for SMTP
    if (payload.attachments?.length) {
      mailConfig.attachments = payload.attachments.map(a => ({
        encoding: 'base64' as const,
        filename: a.filename,
        content: a.content,
        contentType: a.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      }));
    }

    await client.send(mailConfig);
    await client.close();

    return { success: true, messageId: `smtp-${Date.now()}` };
  } catch (error: any) {
    console.error("SMTP send error:", error);
    return { success: false, error: error.message || 'SMTP send failed' };
  }
}

async function sendViaResend(payload: SendEmailPayload): Promise<SendEmailResult> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const resendPayload: any = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };

  if (payload.cc?.length) resendPayload.cc = payload.cc;
  if (payload.bcc?.length) resendPayload.bcc = payload.bcc;
  if (payload.replyTo) resendPayload.reply_to = payload.replyTo;
  if (payload.attachments?.length) resendPayload.attachments = payload.attachments;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(resendPayload),
  });

  const data = await response.json();

  if (!response.ok || data.statusCode >= 400) {
    const errorMessage = data.message || data.error || "Failed to send email";
    return { success: false, error: errorMessage };
  }

  return { success: true, messageId: data.id };
}

/**
 * Unified email sending function.
 * Routes to SMTP or Resend based on tenant's email_provider setting.
 */
export async function sendEmail(
  tenantId: string | null | undefined,
  payload: SendEmailPayload
): Promise<SendEmailResult> {
  // If no tenant, use Resend
  if (!tenantId) {
    return sendViaResend(payload);
  }

  const config = await getSmtpConfig(tenantId);

  if (config.provider === 'smtp' && config.smtp) {
    console.log(`Sending email via SMTP (${config.smtp.host}) for tenant ${tenantId}`);
    const result = await sendViaSmtp(config.smtp, payload);
    // If SMTP fails, don't fallback - return error so tenant can fix config
    return result;
  }

  console.log(`Sending email via Resend for tenant ${tenantId}`);
  return sendViaResend(payload);
}