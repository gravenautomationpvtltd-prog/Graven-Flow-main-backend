import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface TenantEmailConfig {
  senderName: string;
  senderDomain: string;
  replyTo: string;
  companyName: string;
  address1: string;
  address2: string;
  address3: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  phones: string[];
  email: string;
  website: string;
  logoUrl: string | null;
}

const DEFAULTS: TenantEmailConfig = {
  senderName: 'Graven Automation',
  senderDomain: 'gravenautomation.com',
  replyTo: 'sales@gravenautomation.com',
  companyName: 'GRAVEN AUTOMATION PRIVATE LIMITED',
  address1: '7/25, Tower F, 2nd Floor',
  address2: 'Kirti Nagar Industrial Area',
  address3: 'New Delhi 110015',
  gstin: '07AAKCG1025G1ZX',
  stateCode: '07',
  stateName: 'Delhi',
  phones: ['7905350134', '9919089567'],
  email: 'info@gravenautomation.com',
  website: 'gravenautomation.com',
  logoUrl: null,
};

export async function getTenantEmailConfig(tenantId?: string | null): Promise<TenantEmailConfig> {
  if (!tenantId) return { ...DEFAULTS };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('company_name, logo_url, address, city, state, country, phone, email, website, gst_number')
    .eq('id', tenantId)
    .single();

  // Fetch email settings from company_settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('setting_key, setting_value')
    .eq('tenant_id', tenantId)
    .in('setting_key', ['email_sender_name', 'email_sender_domain', 'email_reply_to']);

  const getSettingValue = (key: string): string | null => {
    return settings?.find((s: any) => s.setting_key === key)?.setting_value || null;
  };

  const config: TenantEmailConfig = { ...DEFAULTS };

  if (tenant) {
    config.companyName = tenant.company_name || DEFAULTS.companyName;
    config.logoUrl = tenant.logo_url || null;
    config.email = tenant.email || DEFAULTS.email;
    config.website = tenant.website || DEFAULTS.website;
    config.gstin = tenant.gst_number || DEFAULTS.gstin;

    if (tenant.address) config.address1 = tenant.address;
    if (tenant.city) config.address2 = tenant.city;
    if (tenant.state) {
      config.address3 = `${tenant.state}${tenant.country ? ', ' + tenant.country : ''}`;
      config.stateName = tenant.state;
    }
    if (tenant.phone) config.phones = [tenant.phone];
  }

  // Override with email-specific settings
  config.senderName = getSettingValue('email_sender_name') || config.companyName || DEFAULTS.senderName;
  config.senderDomain = getSettingValue('email_sender_domain') || DEFAULTS.senderDomain;
  config.replyTo = getSettingValue('email_reply_to') || DEFAULTS.replyTo;

  return config;
}

export function buildFromAddress(config: TenantEmailConfig, prefix: string = 'info'): string {
  return `${config.senderName} <${prefix}@${config.senderDomain}>`;
}
