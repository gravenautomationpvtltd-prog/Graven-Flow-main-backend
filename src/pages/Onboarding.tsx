import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { Building2, Loader2 } from 'lucide-react';
import { CompanyInfoStep } from '@/components/onboarding/CompanyInfoStep';
import { AdminProfileStep } from '@/components/onboarding/AdminProfileStep';
import { InviteTeamStep } from '@/components/onboarding/InviteTeamStep';
import { ChoosePlanStep } from '@/components/onboarding/ChoosePlanStep';
import { ConfirmationStep } from '@/components/onboarding/ConfirmationStep';
import { RazorpayCheckout } from '@/components/payments/RazorpayCheckout';
import { useTranslation } from '@/lib/i18n';

export interface OnboardingData {
  company: {
    name: string; logoUrl: string | null; address: string; city: string;
    state: string; country: string; phone: string; email: string;
    website: string; gstNumber: string; industry: string;
  };
  admin: { fullName: string; email: string; phone: string };
  team: Array<{ email: string; role: 'admin' | 'member' }>;
  plan: 'monthly' | 'half_yearly' | 'annual' | 'trial';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { hasTenant, loading: tenantLoading } = useTenantStatus();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    company: {
      name: '', logoUrl: null, address: '', city: '', state: '',
      country: 'India', phone: '', email: '', website: '', gstNumber: '', industry: '',
    },
    admin: { fullName: profile?.full_name || '', email: user?.email || '', phone: profile?.phone || '' },
    team: [],
    plan: 'trial',
  });

  const STEPS = [
    t('onboarding.step_company', 'Company Info'),
    t('onboarding.step_admin', 'Admin Profile'),
    t('onboarding.step_team', 'Invite Team'),
    t('onboarding.step_plan', 'Choose Plan'),
    t('onboarding.step_confirm', 'Confirm'),
  ];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const updateData = (section: keyof OnboardingData, value: any) => {
    setData((d) => ({ ...d, [section]: value }));
  };

  const handleLaunch = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      await ensureFreshSession();

      // Pre-check: if user already has a tenant, skip bootstrap
      const { data: existingTu } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingTu?.tenant_id) {
        toast.success(t('onboarding.org_exists', 'Organization already set up! Redirecting...'));
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = '/dashboard';
        return;
      }

      const { data: tenantId, error: rpcError } = await supabase.rpc('bootstrap_tenant_onboarding', {
        p_company_name: data.company.name,
        p_logo_url: data.company.logoUrl || null,
        p_address: data.company.address,
        p_city: data.company.city,
        p_state: data.company.state,
        p_country: data.company.country,
        p_phone: data.company.phone,
        p_email: data.company.email,
        p_website: data.company.website,
        p_gst_number: data.company.gstNumber || null,
        p_industry: data.company.industry || null,
        p_admin_phone: data.admin.phone || null,
      });

      if (rpcError) throw rpcError;

      if (data.plan !== 'trial') {
        setCreatedTenantId(tenantId);
        setShowPayment(true);
        setSubmitting(false);
        return;
      }

      toast.success(t('onboarding.org_created', 'Organization created! Welcome.'));
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Onboarding error:', err);

      // Recovery: check if tenant was actually created despite the error
      try {
        const { data: recoveryTu } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (recoveryTu?.tenant_id) {
          toast.success(t('onboarding.org_exists', 'Organization already set up! Redirecting...'));
          setTimeout(() => { window.location.href = '/dashboard'; }, 500);
          return;
        }
      } catch (_) {
        // ignore recovery check failure
      }

      const msg = err.message || 'Failed to create organization';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!tenantLoading && hasTenant) {
      window.location.href = '/dashboard';
    }
  }, [tenantLoading, hasTenant]);

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('onboarding.checking_account', 'Checking account status...')}</p>
        </div>
      </div>
    );
  }

  if (hasTenant) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Graven Setup</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/dashboard')} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
              {t('onboarding.back_dashboard', '← Dashboard')}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/auth'; }} className="text-sm text-destructive hover:text-destructive/80 px-3 py-1.5 rounded-md hover:bg-destructive/10 transition-colors">
              {t('action.logout', 'Sign Out')}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-6 pt-8">
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
              <span className={`text-xs ${i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {showPayment && createdTenantId && data.plan !== 'trial' ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <h2 className="text-2xl font-bold text-foreground">{t('onboarding.complete_payment', 'Complete Payment')}</h2>
            <p className="text-muted-foreground text-center max-w-md">{t('onboarding.payment_desc', 'Your organization has been created. Complete payment to activate your subscription.')}</p>
            <RazorpayCheckout
              planType={data.plan as 'monthly' | 'half_yearly' | 'annual'}
              userCount={1}
              tenantId={createdTenantId}
              onSuccess={() => { toast.success('Payment successful!'); window.location.href = '/dashboard'; }}
              onCancel={() => { toast.info('You can pay later from Settings.'); window.location.href = '/dashboard'; }}
              buttonLabel={t('onboarding.pay_activate', 'Pay & Activate')}
              className="w-full max-w-xs"
            />
            <button onClick={() => { toast.info('You can subscribe later from Settings.'); window.location.href = '/dashboard'; }} className="text-sm text-muted-foreground underline hover:text-foreground">
              {t('onboarding.skip_for_now', 'Skip for now')}
            </button>
          </div>
        ) : submitting ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('onboarding.setting_up', 'Setting up your organization...')}</p>
          </div>
        ) : (
          <>
            {step === 0 && <CompanyInfoStep data={data.company} onChange={(v) => updateData('company', v)} onNext={next} />}
            {step === 1 && <AdminProfileStep data={data.admin} onChange={(v) => updateData('admin', v)} onNext={next} onBack={prev} />}
            {step === 2 && <InviteTeamStep data={data.team} onChange={(v) => updateData('team', v)} onNext={next} onBack={prev} />}
            {step === 3 && <ChoosePlanStep selected={data.plan} onChange={(v) => updateData('plan', v)} onNext={next} onBack={prev} />}
            {step === 4 && <ConfirmationStep data={data} onBack={prev} onLaunch={handleLaunch} />}
          </>
        )}
      </div>
    </div>
  );
}
