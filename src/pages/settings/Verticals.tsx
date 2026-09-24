import { Helmet } from 'react-helmet-async';
import { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Trash2, Users, Star, StarOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { useVertical, type Vertical } from '@/contexts/VerticalContext';
import { AccessDenied } from '@/components/ui/access-denied';

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  full_name: string | null;
  email: string | null;
}

interface TenantUserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export default function VerticalsSettings() {
  const { tenantRole } = useTenantStatus();
  const { tenant } = useTenantStatus();
  const { verticals, refresh, activeVerticalId, switchVertical } = useVertical();
  const { user } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [memberDialogFor, setMemberDialogFor] = useState<Vertical | null>(null);
  const canManage = tenantRole === 'owner' || tenantRole === 'admin';

  if (!canManage) return <AccessDenied />;

  return (
    <>
      <Helmet>
        <title>Business Verticals | Graven OneDesk</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Business Verticals</h1>
              <p className="text-muted-foreground">
                Run multiple business lines (e.g. Graven Automation, Glidex Lubricants) inside the same organization.
                Each vertical has its own pipelines, products, numbering and team.
              </p>
            </div>
          </div>
          <CreateVerticalButton
            tenantId={tenant?.id ?? null}
            open={openCreate}
            setOpen={setOpenCreate}
            onCreated={refresh}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {verticals.map((v) => (
            <VerticalCard
              key={v.id}
              vertical={v}
              isActive={v.id === activeVerticalId}
              onActivate={() => switchVertical(v.id)}
              onChanged={refresh}
              onOpenMembers={() => setMemberDialogFor(v)}
            />
          ))}
          {verticals.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-muted-foreground">
                No verticals yet. Add your first one to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {memberDialogFor && (
        <MembersDialog
          vertical={memberDialogFor}
          tenantId={tenant?.id ?? null}
          onClose={() => setMemberDialogFor(null)}
        />
      )}
    </>
  );
}

function VerticalCard({
  vertical, isActive, onActivate, onChanged, onOpenMembers,
}: {
  vertical: Vertical;
  isActive: boolean;
  onActivate: () => void;
  onChanged: () => Promise<void> | void;
  onOpenMembers: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const setDefault = async () => {
    setBusy('default');
    try {
      // Unset existing default
      await supabase.from('verticals' as any)
        .update({ is_default: false } as any)
        .eq('tenant_id', vertical.tenant_id)
        .eq('is_default', true);
      const { error } = await supabase.from('verticals' as any)
        .update({ is_default: true } as any)
        .eq('id', vertical.id);
      if (error) throw error;
      toast.success('Default vertical updated');
      await onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally { setBusy(null); }
  };

  const toggleActive = async () => {
    if (vertical.is_default && vertical.is_active) {
      toast.error('Cannot deactivate the default vertical. Set another as default first.');
      return;
    }
    setBusy('active');
    try {
      const { error } = await supabase.from('verticals' as any)
        .update({ is_active: !vertical.is_active } as any)
        .eq('id', vertical.id);
      if (error) throw error;
      toast.success(vertical.is_active ? 'Vertical deactivated' : 'Vertical activated');
      await onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally { setBusy(null); }
  };

  return (
    <Card className={isActive ? 'border-primary shadow-sm' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="truncate">{vertical.name}</span>
          <div className="flex items-center gap-1">
            {vertical.is_default && <Badge variant="secondary">Default</Badge>}
            {isActive && <Badge>Active</Badge>}
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Code <span className="font-mono">{vertical.code}</span> · Prefix{' '}
          <span className="font-mono">{vertical.doc_prefix}</span> · {vertical.currency ?? 'INR'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onActivate} disabled={isActive}>
            {isActive ? 'Currently Active' : 'Switch to this'}
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenMembers}>
            <Users className="h-4 w-4 mr-1" /> Members
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={setDefault} disabled={vertical.is_default || !!busy}
          >
            {vertical.is_default ? <><Star className="h-4 w-4 mr-1" /> Default</>
              : <><StarOff className="h-4 w-4 mr-1" /> Make default</>}
          </Button>
          <Button
            size="sm" variant={vertical.is_active ? 'ghost' : 'default'}
            onClick={toggleActive} disabled={!!busy}
          >
            {vertical.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateVerticalButton({
  tenantId, open, setOpen, onCreated,
}: {
  tenantId: string | null;
  open: boolean;
  setOpen: (b: boolean) => void;
  onCreated: () => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [prefix, setPrefix] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(''); setCode(''); setPrefix(''); };

  const submit = async () => {
    if (!tenantId) return;
    if (!name.trim() || !code.trim() || !prefix.trim()) {
      toast.error('Name, code and prefix are required');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('verticals' as any).insert({
        tenant_id: tenantId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        doc_prefix: prefix.trim().toUpperCase(),
        is_default: false,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.success(`Vertical "${name}" created`);
      reset();
      setOpen(false);
      await onCreated();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create vertical');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Vertical</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new vertical</DialogTitle>
          <DialogDescription>
            Each vertical is an isolated business line with its own leads, products, and document numbering.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Glidex Lubricants" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GLIDEX" />
            </div>
            <div>
              <Label>Doc Prefix</Label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="GL" maxLength={5} />
              <p className="text-xs text-muted-foreground mt-1">Used for numbering: {prefix || 'XX'}-Q-2026-0001</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({
  vertical, tenantId, onClose,
}: { vertical: Vertical; tenantId: string | null; onClose: () => void }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: vu }, { data: tu }] = await Promise.all([
      supabase.from('vertical_users' as any).select('*').eq('vertical_id', vertical.id),
      supabase.from('tenant_users').select('user_id, role, is_active').eq('tenant_id', tenantId).eq('is_active', true),
    ]);

    const userIds = Array.from(new Set([
      ...((vu ?? []) as any[]).map((r) => r.user_id),
      ...((tu ?? []) as any[]).map((r) => r.user_id),
    ]));
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      for (const p of (profs ?? []) as any[]) profiles[p.id] = { full_name: p.full_name, email: p.email };
    }

    setMembers(((vu ?? []) as any[]).map((r) => ({
      id: r.id, user_id: r.user_id, role: r.role, is_active: r.is_active,
      full_name: profiles[r.user_id]?.full_name ?? null,
      email: profiles[r.user_id]?.email ?? null,
    })));
    setTenantUsers(((tu ?? []) as any[]).map((r) => ({
      user_id: r.user_id, role: r.role,
      full_name: profiles[r.user_id]?.full_name ?? null,
      email: profiles[r.user_id]?.email ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [vertical.id, tenantId]);

  const memberIds = useMemo(() => new Set(members.filter((m) => m.is_active).map((m) => m.user_id)), [members]);
  const available = tenantUsers.filter((u) => !memberIds.has(u.user_id));

  const add = async (userId: string, role: string) => {
    setAdding(userId);
    try {
      const existing = members.find((m) => m.user_id === userId);
      if (existing) {
        const { error } = await supabase.from('vertical_users' as any)
          .update({ is_active: true, role } as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vertical_users' as any).insert({
          vertical_id: vertical.id, user_id: userId, role, is_active: true,
        } as any);
        if (error) throw error;
      }
      toast.success('Member added');
      await load();
    } catch (e: any) { toast.error(e.message ?? 'Failed'); }
    finally { setAdding(null); }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from('vertical_users' as any)
        .update({ is_active: false } as any).eq('id', id);
      if (error) throw error;
      toast.success('Member removed');
      await load();
    } catch (e: any) { toast.error(e.message ?? 'Failed'); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vertical.name} — Members</DialogTitle>
          <DialogDescription>
            Only members of this vertical see its leads, orders, and dashboards.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Current members ({members.filter((m) => m.is_active).length})</h3>
              <div className="border rounded-md divide-y max-h-64 overflow-auto">
                {members.filter((m) => m.is_active).length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">No members yet.</div>
                )}
                {members.filter((m) => m.is_active).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.full_name ?? m.email ?? m.user_id}</div>
                      <div className="text-xs text-muted-foreground">{m.email} · {m.role}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Add from organization ({available.length})</h3>
              <div className="border rounded-md divide-y max-h-64 overflow-auto">
                {available.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">All members are already added.</div>
                )}
                {available.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.full_name ?? u.email ?? u.user_id}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <Button size="sm" onClick={() => add(u.user_id, u.role)} disabled={adding === u.user_id}>
                      {adding === u.user_id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
