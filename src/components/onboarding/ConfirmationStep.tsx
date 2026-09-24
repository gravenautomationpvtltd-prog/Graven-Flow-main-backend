import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Rocket } from 'lucide-react';
import type { OnboardingData } from '@/pages/Onboarding';
import { useTranslation } from '@/lib/i18n';

interface Props {
  data: OnboardingData;
  onBack: () => void;
  onLaunch: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Demo (30 days)',
  monthly: 'Monthly — ₹1,500/user/mo',
  half_yearly: 'Half-Yearly — ₹1,200/user/mo',
  annual: 'Annual — ₹750/user/mo',
};

export function ConfirmationStep({ data, onBack, onLaunch }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.review_launch', 'Review & Launch')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('onboarding.review_launch_desc', 'Confirm your details before getting started')}</p>
      </div>

      <div className="grid gap-4">
        <Card className="border-border">
          <CardContent className="p-5 space-y-2">
            <h3 className="font-semibold text-foreground text-sm">{t('settings.company', 'Company')}</h3>
            <div className="flex items-center gap-3">
              {data.company.logoUrl && <img src={data.company.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-border" />}
              <div>
                <p className="text-foreground font-medium">{data.company.name}</p>
                <p className="text-xs text-muted-foreground">{[data.company.city, data.company.state, data.company.country].filter(Boolean).join(', ')}</p>
              </div>
            </div>
            {data.company.email && <p className="text-xs text-muted-foreground">{data.company.email}</p>}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <h3 className="font-semibold text-foreground text-sm">Admin</h3>
            <p className="text-sm text-foreground">{data.admin.fullName}</p>
            <p className="text-xs text-muted-foreground">{data.admin.email}</p>
            {data.admin.phone && <p className="text-xs text-muted-foreground">{data.admin.phone}</p>}
          </CardContent>
        </Card>

        {data.team.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <h3 className="font-semibold text-foreground text-sm">{t('settings.team', 'Team')} ({data.team.length})</h3>
              {data.team.map((m, i) => (
                <p key={i} className="text-xs text-muted-foreground">{m.email} — <span className="capitalize">{m.role}</span></p>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <h3 className="font-semibold text-foreground text-sm">{t('onboarding.step_plan', 'Plan')}</h3>
            <p className="text-sm text-foreground">{PLAN_LABELS[data.plan]}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> {t('action.back', 'Back')}</Button>
        <Button onClick={onLaunch} className="gap-2"><Rocket className="h-4 w-4" /> {t('onboarding.launch', 'Launch')}</Button>
      </div>
    </div>
  );
}
