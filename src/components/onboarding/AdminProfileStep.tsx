import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Props {
  data: { fullName: string; email: string; phone: string };
  onChange: (data: Props['data']) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AdminProfileStep({ data, onChange, onNext, onBack }: Props) {
  const { t } = useTranslation();
  const set = (field: string, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.admin_profile', 'Admin Profile')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('onboarding.admin_profile_desc', 'Your details as the organization owner')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
        <div className="space-y-2 md:col-span-2">
          <Label>{t('auth.full_name', 'Full Name')}</Label>
          <Input value={data.fullName} onChange={(e) => set('fullName', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('field.email', 'Email')}</Label>
          <Input value={data.email} disabled className="opacity-60" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('field.phone', 'Phone Number')}</Label>
          <Input value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> {t('action.back', 'Back')}
        </Button>
        <Button onClick={onNext}>
          {t('action.continue', 'Continue')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
