import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Plus, X, Lock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface TeamMember { email: string; role: 'admin' | 'member'; }

interface Props {
  data: TeamMember[];
  onChange: (data: TeamMember[]) => void;
  onNext: () => void;
  onBack: () => void;
  isTrial?: boolean;
}

export function InviteTeamStep({ data, onChange, onNext, onBack, isTrial = true }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const { t } = useTranslation();

  const addMember = () => {
    if (isTrial) return;
    if (!email.trim() || !email.includes('@')) return;
    if (data.some((m) => m.email === email.trim())) return;
    onChange([...data, { email: email.trim(), role }]);
    setEmail('');
  };

  const remove = (idx: number) => onChange(data.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.invite_team', 'Invite Team Members')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('onboarding.invite_team_desc', 'Optional — you can always invite people later')}</p>
      </div>

      {isTrial ? (
        <div className="rounded-lg border border-border bg-muted/50 p-5 text-center space-y-2">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {t('onboarding.demo_limit_title', 'Demo accounts are limited to 1 user')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('onboarding.demo_limit_desc', 'Upgrade your subscription after setup to add team members.')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label>{t('field.email', 'Email')}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" onKeyDown={(e) => e.key === 'Enter' && addMember()} />
            </div>
            <div className="w-32 space-y-2">
              <Label>{t('employees.role', 'Role')}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={addMember} className="shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>

          {data.length > 0 && (
            <div className="space-y-2">
              {data.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <span className="text-sm text-foreground">{m.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">{m.role}</span>
                  </div>
                  <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> {t('action.back', 'Back')}</Button>
        <Button onClick={onNext}>
          {isTrial || data.length === 0 ? t('onboarding.skip', 'Skip') : t('action.continue', 'Continue')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
