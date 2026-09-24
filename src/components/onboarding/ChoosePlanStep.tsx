import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type PlanType = 'monthly' | 'half_yearly' | 'annual' | 'trial';

interface Props {
  selected: PlanType;
  onChange: (plan: PlanType) => void;
  onNext: () => void;
  onBack: () => void;
}

const PLANS: { id: PlanType; name: string; price: string; desc: string }[] = [
  { id: 'trial', name: 'Free Demo', price: '₹0', desc: '30 days free trial with all features' },
  { id: 'monthly', name: 'Monthly', price: '₹1,500/user/mo', desc: 'Billed monthly, cancel anytime' },
  { id: 'half_yearly', name: 'Half-Yearly', price: '₹1,200/user/mo', desc: '20% off, billed every 6 months' },
  { id: 'annual', name: 'Annual', price: '₹750/user/mo', desc: '50% off, billed annually' },
];

export function ChoosePlanStep({ selected, onChange, onNext, onBack }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.choose_plan', 'Choose Your Plan')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('onboarding.choose_plan_desc', 'Start free, upgrade anytime')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={`cursor-pointer transition-all ${selected === plan.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`} onClick={() => onChange(plan.id)}>
            <CardContent className="p-5 flex items-start gap-3">
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selected === plan.id ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                {selected === plan.id && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">{plan.name}</p>
                <p className="text-lg font-bold text-foreground">{plan.price}</p>
                <p className="text-xs text-muted-foreground">{plan.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> {t('action.back', 'Back')}</Button>
        <Button onClick={onNext}>{t('action.continue', 'Continue')} <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
