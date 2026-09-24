import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Tag, Shuffle, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const COMMON_BRANDS = [
  'Siemens', 'ABB', 'Mitsubishi', 'Schneider', 'Omron', 'Allen-Bradley',
  'Rockwell', 'Delta', 'Phoenix Contact', 'SICK', 'Festo', 'SMC',
  'Honeywell', 'Yokogawa', 'Wago', 'Beckhoff', 'Danfoss', 'Keyence',
  'Autonics', 'Eaton',
];

export default function BrandMappingSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [brand, setBrand] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');

  const { data: tenantId } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      return (data as any)?.tenant_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: owners = [], isLoading: ownersLoading } = useQuery({
    queryKey: ['brand-owners', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_owners' as any)
        .select('id, brand, owner_user_id, profile:profiles!brand_owners_owner_user_id_fkey(full_name)')
        .eq('tenant_id', tenantId)
        .order('brand');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: procUsers = [] } = useQuery({
    queryKey: ['procurement-users-with-flags', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'procurement');
      if (roleErr) throw roleErr;
      const userIds = (roleRows || []).map((r: any) => r.user_id).filter(Boolean);
      if (userIds.length === 0) return [];
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, round_robin_paused, tenant_id')
        .in('id', userIds)
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (profErr) throw profErr;
      return profiles || [];
    },
  });

  const { data: orphanBrands = [] } = useQuery({
    queryKey: ['orphan-brands', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enquiry_items' as any)
        .select('brand, routed_via')
        .eq('routed_via', 'round_robin')
        .not('brand', 'is', null)
        .limit(500);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data || []).forEach((r: any) => {
        if (r.brand) counts.set(r.brand, (counts.get(r.brand) || 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: includeMgrSetting, refetch: refetchMgrSetting } = useQuery({
    queryKey: ['include-mgr-rr', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('id, setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_key', 'include_manager_in_round_robin')
        .maybeSingle();
      return data || null;
    },
  });

  const includeMgr = includeMgrSetting?.setting_value === 'true';

  const addOwner = useMutation({
    mutationFn: async () => {
      if (!brand.trim() || !ownerId || !tenantId) throw new Error('Missing fields');
      const { error } = await supabase.from('brand_owners' as any).insert({
        brand: brand.trim(),
        owner_user_id: ownerId,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Brand owner added');
      setBrand('');
      setOwnerId('');
      qc.invalidateQueries({ queryKey: ['brand-owners'] });
      qc.invalidateQueries({ queryKey: ['orphan-brands'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  const removeOwner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brand_owners' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed');
      qc.invalidateQueries({ queryKey: ['brand-owners'] });
    },
  });

  const togglePause = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ round_robin_paused: paused } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement-users-with-flags'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleManagerInRR = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!tenantId) return;
      if (includeMgrSetting?.id) {
        await supabase
          .from('company_settings')
          .update({ setting_value: enabled ? 'true' : 'false' })
          .eq('id', includeMgrSetting.id);
      } else {
        await supabase.from('company_settings').insert({
          tenant_id: tenantId,
          setting_key: 'include_manager_in_round_robin',
          setting_value: enabled ? 'true' : 'false',
        });
      }
    },
    onSuccess: () => {
      toast.success('Updated');
      refetchMgrSetting();
    },
  });

  const ownedBrandSet = useMemo(
    () => new Set(owners.map((o: any) => o.brand.toLowerCase())),
    [owners]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Brand Ownership & Routing</h1>
          <p className="text-sm text-muted-foreground">
            Route enquiry items by brand. Unmapped brands fall back to round-robin among procurement officers.
          </p>
        </div>
      </div>

      {/* Add owner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add brand owner</CardTitle>
          <CardDescription>One officer per brand. Future enquiry items for this brand go straight to them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Siemens"
                list="common-brands"
              />
              <datalist id="common-brands">
                {COMMON_BRANDS.filter((b) => !ownedBrandSet.has(b.toLowerCase())).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Procurement owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select officer" />
                </SelectTrigger>
                <SelectContent>
                  {procUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => addOwner.mutate()}
              disabled={!brand.trim() || !ownerId || addOwner.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add owner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing owners */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand owners</CardTitle>
        </CardHeader>
        <CardContent>
          {ownersLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No brand owners yet — every enquiry item is being distributed via round-robin.
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Brand</th>
                    <th className="text-left px-3 py-2">Owner</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o: any) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{o.brand}</td>
                      <td className="px-3 py-2">{o.profile?.full_name || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeOwner.mutate(o.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orphan brands */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-4 w-4" /> Brands without an owner
          </CardTitle>
          <CardDescription>
            Detected from recent enquiries — currently routed via round-robin. Assign an owner to skip rotation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orphanBrands.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orphan brands recently. 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orphanBrands.map((b) => (
                <Badge
                  key={b.brand}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setBrand(b.brand)}
                >
                  {b.brand} <span className="ml-1 text-muted-foreground">· {b.count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Round-robin controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Round-robin controls
          </CardTitle>
          <CardDescription>
            Configure who participates in the rotation when no brand owner is set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Include procurement manager in rotation</p>
              <p className="text-xs text-muted-foreground">
                By default the manager only supervises. Turn on to make them take items too.
              </p>
            </div>
            <Switch
              checked={includeMgr}
              onCheckedChange={(v) => toggleManagerInRR.mutate(v)}
            />
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Officer</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-right px-3 py-2">Active in rotation</th>
                </tr>
              </thead>
              <tbody>
                {procUsers.map((u: any) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{u.full_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2 text-right">
                      <Switch
                        checked={!u.round_robin_paused}
                        onCheckedChange={(v) => togglePause.mutate({ id: u.id, paused: !v })}
                      />
                    </td>
                  </tr>
                ))}
                {procUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-sm">
                      No procurement officers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
