import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Globe, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { getTaxSystem } from '@/lib/tax-utils';
import { Badge } from '@/components/ui/badge';

export function LocalizationSettings() {
  const { t, language, setLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedLang, setSelectedLang] = useState(language);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');

  // Fetch languages
  const { data: languages } = useQuery({
    queryKey: ['languages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch currencies
  const { data: currencies } = useQuery({
    queryKey: ['all-currencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['all-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch industries
  const { data: industries } = useQuery({
    queryKey: ['industries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant settings
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-localization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('tenants')
        .select('id, default_currency, default_language, country_code, industry')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (tenantData) {
      setSelectedCurrency(tenantData.default_currency || 'INR');
      setSelectedCountry(tenantData.country_code || '');
      setSelectedIndustry(tenantData.industry || '');
      setSelectedLang(tenantData.default_language || 'en');
    }
  }, [tenantData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantData) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenants')
        .update({
          default_currency: selectedCurrency,
          default_language: selectedLang,
          country_code: selectedCountry || null,
          industry: selectedIndustry || null,
        })
        .eq('id', tenantData.id);
      if (error) throw error;

      // Update user's preferred language
      setLanguage(selectedLang);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-localization'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-profile'] });
      toast.success(t('toast.saved'));
      setHasChanges(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const taxSystem = selectedCountry ? getTaxSystem(selectedCountry) : null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>{t('localization.title')}</CardTitle>
          </div>
          <CardDescription>{t('localization.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language */}
          <div className="space-y-2">
            <Label>{t('localization.language')}</Label>
            <p className="text-xs text-muted-foreground">{t('localization.language_desc')}</p>
            <Select value={selectedLang} onValueChange={(v) => { setSelectedLang(v); setHasChanges(true); }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages?.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.native_name} ({lang.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label>{t('localization.industry')}</Label>
            <p className="text-xs text-muted-foreground">{t('localization.industry_desc')}</p>
            <Select value={selectedIndustry} onValueChange={(v) => { setSelectedIndustry(v); setHasChanges(true); }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industries?.map((ind) => (
                  <SelectItem key={ind.code} value={ind.code}>{ind.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label>{t('localization.country')}</Label>
            <p className="text-xs text-muted-foreground">{t('localization.country_desc')}</p>
            <Select value={selectedCountry} onValueChange={(v) => { setSelectedCountry(v); setHasChanges(true); }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries?.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Currency */}
          <div className="space-y-2">
            <Label>{t('localization.default_currency')}</Label>
            <p className="text-xs text-muted-foreground">{t('localization.default_currency_desc')}</p>
            <Select value={selectedCurrency} onValueChange={(v) => { setSelectedCurrency(v); setHasChanges(true); }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} — {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tax System Preview */}
          {taxSystem && (
            <div className="space-y-2 rounded-lg border border-border p-4 bg-muted/30">
              <Label>{t('localization.tax_system')}</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{taxSystem.type}</Badge>
                <span className="text-sm text-muted-foreground">{taxSystem.label}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Tax ID Label:</span> {taxSystem.taxIdLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Components:</span>{' '}
                {taxSystem.components.map((c) => `${c.name} (${c.defaultRate}%)`).join(', ')}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Available Rates:</span>{' '}
                {taxSystem.rates.map((r) => `${r}%`).join(', ')}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? t('action.saving') : t('action.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
