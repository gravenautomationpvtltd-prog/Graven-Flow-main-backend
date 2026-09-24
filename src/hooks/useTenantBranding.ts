import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TenantBranding {
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
  logoBase64: string | null; // For jsPDF
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankIfsc: string | null;
}

const DEFAULTS: TenantBranding = {
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
  logoBase64: null,
  bankName: 'ICICI BANK',
  bankAccountNumber: '777705098567',
  bankBranch: 'JANKIPURAM EXTN.,LUCKNOW',
  bankIfsc: 'ICIC0004074',
};

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function fetchTenantBranding(userId: string): Promise<TenantBranding> {
  // Get user's tenant
  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!tu?.tenant_id) return { ...DEFAULTS };

  const { data: tenant } = await supabase
    .from('tenants')
    .select('company_name, logo_url, address, city, state, country, phone, email, website, gst_number, bank_name, bank_account_number, bank_branch, bank_ifsc')
    .eq('id', tu.tenant_id)
    .single();

  if (!tenant) return { ...DEFAULTS };

  const branding: TenantBranding = {
    companyName: tenant.company_name || DEFAULTS.companyName,
    address1: tenant.address || DEFAULTS.address1,
    address2: tenant.city || DEFAULTS.address2,
    address3: tenant.state
      ? `${tenant.state}${tenant.country ? ', ' + tenant.country : ''}`
      : DEFAULTS.address3,
    gstin: tenant.gst_number || DEFAULTS.gstin,
    stateCode: tenant.gst_number?.substring(0, 2) || DEFAULTS.stateCode,
    stateName: tenant.state || DEFAULTS.stateName,
    phones: tenant.phone ? [tenant.phone] : DEFAULTS.phones,
    email: tenant.email || DEFAULTS.email,
    website: tenant.website || DEFAULTS.website,
    logoUrl: tenant.logo_url || null,
    logoBase64: null,
    bankName: tenant.bank_name || DEFAULTS.bankName,
    bankAccountNumber: tenant.bank_account_number || DEFAULTS.bankAccountNumber,
    bankBranch: tenant.bank_branch || DEFAULTS.bankBranch,
    bankIfsc: tenant.bank_ifsc || DEFAULTS.bankIfsc,
  };

  // Fetch logo as base64 for jsPDF
  if (branding.logoUrl) {
    branding.logoBase64 = await fetchLogoAsBase64(branding.logoUrl);
  }

  return branding;
}

export function useTenantBranding() {
  const { user } = useAuth();

  const { data: branding = DEFAULTS, isLoading } = useQuery({
    queryKey: ['tenant-branding', user?.id],
    queryFn: () => fetchTenantBranding(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  return { branding, isLoading };
}
