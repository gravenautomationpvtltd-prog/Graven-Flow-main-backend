import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Upload, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Manufacturing', 'Trading', 'IT & Software', 'Construction', 'Healthcare',
  'Education', 'Retail', 'Hospitality', 'Logistics', 'Agriculture', 'Other',
];

interface TenantData {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gst_number: string | null;
  industry: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_ifsc: string | null;
}

export function CompanyProfileSettings() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState<Partial<TenantData>>({});

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
      if (!tenantId) throw new Error('No tenant found');
      const { data, error } = await supabase
        .from('tenants')
        .select('id, company_name, logo_url, address, city, state, country, phone, email, website, gst_number, industry, bank_name, bank_account_number, bank_branch, bank_ifsc')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data as TenantData;
    },
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        company_name: tenant.company_name,
        logo_url: tenant.logo_url,
        address: tenant.address || '',
        city: tenant.city || '',
        state: tenant.state || '',
        country: tenant.country || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        website: tenant.website || '',
        gst_number: tenant.gst_number || '',
        industry: tenant.industry || '',
        bank_name: tenant.bank_name || '',
        bank_account_number: tenant.bank_account_number || '',
        bank_branch: tenant.bank_branch || '',
        bank_ifsc: tenant.bank_ifsc || '',
      });
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TenantData>) => {
      if (!tenant) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-profile'] });
      toast.success('Company profile updated');
      setHasChanges(false);
    },
    onError: (err: Error) => toast.error('Failed to update: ' + err.message),
  });

  const set = (field: string, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('tenant-logos').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('tenant-logos').getPublicUrl(path);
    set('logo_url', urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = () => {
    const { company_name, logo_url, address, city, state, country, phone, email, website, gst_number, industry, bank_name, bank_account_number, bank_branch, bank_ifsc } = form;
    updateMutation.mutate({ company_name, logo_url, address, city, state, country, phone, email, website, gst_number, industry, bank_name, bank_account_number, bank_branch, bank_ifsc } as any);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">Loading company profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!tenant) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Company Profile</CardTitle>
        </div>
        <CardDescription>
          Update your organization's details. These are used on quotations, invoices, and email communications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <div className="relative h-16 w-16 rounded-lg border border-border overflow-hidden">
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                <button onClick={() => set('logo_url', null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
            )}
            <span className="text-xs text-muted-foreground">
              {uploading ? 'Uploading...' : 'PNG or JPG, max 2MB'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Company Name *</Label>
            <Input value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="123 Business St" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="Maharashtra" />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={form.country || ''} onChange={(e) => set('country', e.target.value)} placeholder="India" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="info@company.com" />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="https://company.com" />
          </div>
          <div className="space-y-2">
            <Label>GST Number</Label>
            <Input value={form.gst_number || ''} onChange={(e) => set('gst_number', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={form.industry || ''} onValueChange={(v) => set('industry', v)}>
              <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="border-t border-border pt-6 mt-2">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Bank Account Details
            <span className="text-xs font-normal text-muted-foreground">(shown on Quotations & Invoices)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={form.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} placeholder="e.g. State Bank of India" />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={form.bank_account_number || ''} onChange={(e) => set('bank_account_number', e.target.value)} placeholder="e.g. 1234567890" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={form.bank_branch || ''} onChange={(e) => set('bank_branch', e.target.value)} placeholder="e.g. Main Branch, New Delhi" />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input value={form.bank_ifsc || ''} onChange={(e) => set('bank_ifsc', e.target.value)} placeholder="e.g. SBIN0001234" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
