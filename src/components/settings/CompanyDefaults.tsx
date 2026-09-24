import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Save, Building2, Percent } from 'lucide-react';
import { useCompanySettings, useUpdateCompanySetting, MIN_MARGIN_SETTING_KEY } from '@/hooks/useCompanySettings';
import { DEFAULT_MIN_MARGIN_PCT } from '@/lib/pricing';

export function CompanyDefaults() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSetting = useUpdateCompanySetting();
  
  const [defaultPhone, setDefaultPhone] = useState('');
  const [defaultEmail, setDefaultEmail] = useState('');
  const [minMargin, setMinMargin] = useState(String(DEFAULT_MIN_MARGIN_PCT));
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when data is available
  useEffect(() => {
    if (settings) {
      const phone = settings.find(s => s.setting_key === 'default_contact_phone')?.setting_value || '';
      const email = settings.find(s => s.setting_key === 'default_contact_email')?.setting_value || '';
      const margin = settings.find(s => s.setting_key === MIN_MARGIN_SETTING_KEY)?.setting_value;
      setDefaultPhone(phone);
      setDefaultEmail(email);
      setMinMargin(margin ?? String(DEFAULT_MIN_MARGIN_PCT));
    }
  }, [settings]);

  const handlePhoneChange = (value: string) => {
    setDefaultPhone(value);
    setHasChanges(true);
  };

  const handleEmailChange = (value: string) => {
    setDefaultEmail(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await Promise.all([
      updateSetting.mutateAsync({ settingKey: 'default_contact_phone', settingValue: defaultPhone }),
      updateSetting.mutateAsync({ settingKey: 'default_contact_email', settingValue: defaultEmail }),
      updateSetting.mutateAsync({
        settingKey: MIN_MARGIN_SETTING_KEY,
        settingValue: String(Number(minMargin) >= 0 && Number.isFinite(Number(minMargin)) ? Number(minMargin) : DEFAULT_MIN_MARGIN_PCT),
      }),
    ]);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Default Contact Information</CardTitle>
        </div>
        <CardDescription>
          Configure default contact details to be used on quotations and invoices when the user creating the document has no phone or email in their profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Default Contact Phone
            </Label>
            <Input
              id="default-phone"
              type="tel"
              placeholder="Enter default phone number"
              value={defaultPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used when the quotation creator has no phone number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Default Contact Email
            </Label>
            <Input
              id="default-email"
              type="email"
              placeholder="Enter default email address"
              value={defaultEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used when the quotation creator has no email address
            </p>
          </div>
        </div>

        <div className="space-y-2 max-w-xs">
          <Label htmlFor="min-margin" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Minimum Gross Margin %
          </Label>
          <Input
            id="min-margin"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={minMargin}
            onChange={(e) => { setMinMargin(e.target.value); setHasChanges(true); }}
          />
          <p className="text-xs text-muted-foreground">
            Quotation lines below this margin need approval. A product's own minimum overrides this.
          </p>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateSetting.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSetting.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
