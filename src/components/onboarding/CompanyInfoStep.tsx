import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

interface Props {
  data: {
    name: string; logoUrl: string | null; address: string; city: string;
    state: string; country: string; phone: string; email: string;
    website: string; gstNumber: string; industry: string;
  };
  onChange: (data: Props['data']) => void;
  onNext: () => void;
}

const INDUSTRIES = [
  'Manufacturing', 'Trading', 'IT & Software', 'Construction', 'Healthcare',
  'Education', 'Retail', 'Hospitality', 'Logistics', 'Agriculture', 'Other',
];

export function CompanyInfoStep({ data, onChange, onNext }: Props) {
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();

  const set = (field: string, value: string | null) => onChange({ ...data, [field]: value });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t('onboarding.logo_too_large', 'Logo must be under 2MB')); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('tenant-logos').upload(path, file);
    if (error) { toast.error(t('onboarding.upload_failed', 'Upload failed')); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('tenant-logos').getPublicUrl(path);
    set('logoUrl', urlData.publicUrl);
    setUploading(false);
  };

  const valid = data.name.trim().length >= 2 && data.email.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.company_info', 'Company Information')}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t('onboarding.company_info_desc', 'Tell us about your organization')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('onboarding.company_logo', 'Company Logo')}</Label>
        <div className="flex items-center gap-4">
          {data.logoUrl ? (
            <div className="relative h-16 w-16 rounded-lg border border-border overflow-hidden">
              <img src={data.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              <button onClick={() => set('logoUrl', null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
          )}
          <span className="text-xs text-muted-foreground">{t('onboarding.logo_hint', 'PNG or JPG, max 2MB')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>{t('onboarding.company_name', 'Company Name')} *</Label>
          <Input value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="Acme Corp" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('field.address', 'Address')}</Label>
          <Input value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Business St" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.city', 'City')}</Label>
          <Input value={data.city} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.state', 'State')}</Label>
          <Input value={data.state} onChange={(e) => set('state', e.target.value)} placeholder="Maharashtra" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.country', 'Country')}</Label>
          <Input value={data.country} onChange={(e) => set('country', e.target.value)} placeholder="India" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.phone', 'Phone')}</Label>
          <Input value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.email', 'Email')} *</Label>
          <Input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="info@company.com" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.website', 'Website')}</Label>
          <Input value={data.website} onChange={(e) => set('website', e.target.value)} placeholder="https://company.com" />
        </div>
        <div className="space-y-2">
          <Label>{t('tax.gst_number', 'GST Number')}</Label>
          <Input value={data.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} placeholder="22AAAAA0000A1Z5" />
        </div>
        <div className="space-y-2">
          <Label>{t('field.industry', 'Industry')}</Label>
          <Select value={data.industry} onValueChange={(v) => set('industry', v)}>
            <SelectTrigger><SelectValue placeholder={t('onboarding.select_industry', 'Select industry')} /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!valid}>
          {t('action.continue', 'Continue')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
