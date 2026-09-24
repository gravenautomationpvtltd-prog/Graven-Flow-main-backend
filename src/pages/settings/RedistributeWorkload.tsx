import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Users, Shuffle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  useAllTenantUsers,
  useActiveRecipients,
  useUserRoles,
  usePreviewUserBook,
  useRedistributeWorkload,
  type RecipientRole,
} from '@/hooks/useRedistributeWorkload';
import { useUserPresenceToday } from '@/hooks/useUserPresenceToday';

type EntityKey = 'leads' | 'customers' | 'escalations' | 'tasks';

const ENTITY_LABELS: Record<EntityKey, string> = {
  leads: 'Leads',
  customers: 'Customers',
  escalations: 'Open Escalations',
  tasks: 'Open Tasks',
};

export default function RedistributeWorkload() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const allowed = roles?.some((r) => ['super_admin', 'coo', 'cct'].includes(r));

  const [fromUserId, setFromUserId] = useState<string>('');
  const [recipientRole, setRecipientRole] = useState<RecipientRole>('sales');
  const [recipientRoleTouched, setRecipientRoleTouched] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [entities, setEntities] = useState<Set<EntityKey>>(
    new Set(['leads', 'customers', 'escalations', 'tasks']),
  );
  const [includeQuotations, setIncludeQuotations] = useState(false);
  const [includeOrders, setIncludeOrders] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sourceUsers = useAllTenantUsers();
  const sourceRoles = useUserRoles(fromUserId || undefined);

  // Auto-detect recipient pool from source user's roles (unless user manually changed it).
  useMemo(() => {
    if (recipientRoleTouched || !sourceRoles.data) return;
    if (sourceRoles.data.includes('cro')) setRecipientRole('cro');
    else if (sourceRoles.data.includes('sales')) setRecipientRole('sales');
  }, [sourceRoles.data, recipientRoleTouched]);

  const recipients = useActiveRecipients(recipientRole, fromUserId || undefined);
  const presence = useUserPresenceToday(recipients.data?.map((u) => u.id));
  const preview = usePreviewUserBook(fromUserId || undefined);
  const redistribute = useRedistributeWorkload();

  const totalToMove = useMemo(() => {
    if (!preview.data) return 0;
    let n = 0;
    if (entities.has('leads')) n += preview.data.leads;
    if (entities.has('customers')) n += preview.data.customers;
    if (entities.has('escalations')) n += preview.data.escalations;
    if (entities.has('tasks')) n += preview.data.tasks;
    if (includeQuotations) n += preview.data.quotations_authored;
    if (includeOrders) n += preview.data.sales_orders_authored;
    return n;
  }, [preview.data, entities, includeQuotations, includeOrders]);

  const recipientCount = selectedRecipients.size;

  const perRecipient = useMemo(() => {
    if (!preview.data || recipientCount === 0) return null;
    const div = (n: number) => Math.ceil(n / recipientCount);
    return {
      leads: entities.has('leads') ? div(preview.data.leads) : 0,
      customers: entities.has('customers') ? div(preview.data.customers) : 0,
      escalations: entities.has('escalations') ? div(preview.data.escalations) : 0,
      tasks: entities.has('tasks') ? div(preview.data.tasks) : 0,
    };
  }, [preview.data, entities, recipientCount]);

  const toggleRecipient = (id: string, checked: boolean) => {
    const next = new Set(selectedRecipients);
    if (checked) next.add(id); else next.delete(id);
    setSelectedRecipients(next);
  };

  const toggleEntity = (key: EntityKey, checked: boolean) => {
    const next = new Set(entities);
    if (checked) next.add(key); else next.delete(key);
    setEntities(next);
  };

  const selectAllRecipients = () => {
    if (!recipients.data) return;
    setSelectedRecipients(new Set(recipients.data.map((r) => r.id)));
  };
  const clearRecipients = () => setSelectedRecipients(new Set());

  const handleRun = async () => {
    setConfirmOpen(false);
    await redistribute.mutateAsync({
      fromUserId,
      toUserIds: Array.from(selectedRecipients),
      entities: Array.from(entities),
      includeQuotationAuthorship: includeQuotations,
      includeOrderAuthorship: includeOrders,
      recipientRole,
    });
    preview.refetch();
  };

  if (!allowed) {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only Super Admin, COO, and CCT roles can redistribute workload.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const canRun =
    !!fromUserId &&
    recipientCount >= 1 &&
    (entities.size > 0 || includeQuotations || includeOrders) &&
    totalToMove > 0;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Redistribute Workload</h1>
          <p className="text-muted-foreground text-sm">
            Bulk reassign one user's book of work evenly across active sales teammates.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose source user</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={fromUserId} onValueChange={(v) => { setFromUserId(v); setSelectedRecipients(new Set()); setRecipientRoleTouched(false); }}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Select user whose work should be redistributed" />
            </SelectTrigger>
            <SelectContent>
              {sourceUsers.data?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name} <span className="text-muted-foreground text-xs">({u.email})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {fromUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Current book</CardTitle>
            <CardDescription>What this user currently owns</CardDescription>
          </CardHeader>
          <CardContent>
            {preview.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : preview.data ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Active Leads" value={preview.data.leads} />
                <Stat label="Customers" value={preview.data.customers} />
                <Stat label="Open Escalations" value={preview.data.escalations} />
                <Stat label="Open Tasks" value={preview.data.tasks} />
                <Stat label="Quotations Authored" value={preview.data.quotations_authored} muted />
                <Stat label="Orders Authored" value={preview.data.sales_orders_authored} muted />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {fromUserId && (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">3. Recipients</CardTitle>
                <CardDescription>
                  Active {recipientRole === 'cro' ? 'LQT (CRO)' : 'sales'} members only — terminated / inactive users hidden
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllRecipients}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={clearRecipients}>Clear</Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground">Recipient team:</Label>
              <ToggleGroup
                type="single"
                size="sm"
                value={recipientRole}
                onValueChange={(v) => {
                  if (!v) return;
                  setRecipientRole(v as RecipientRole);
                  setRecipientRoleTouched(true);
                  setSelectedRecipients(new Set());
                }}
              >
                <ToggleGroupItem value="sales">Sales</ToggleGroupItem>
                <ToggleGroupItem value="cro">LQT</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            {recipients.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : recipients.data && recipients.data.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {recipients.data.map((u) => {
                  const status = presence.data?.[u.id] ?? 'not_checked_in';
                  const badge =
                    status === 'present'
                      ? { label: 'Present today', variant: 'default' as const }
                      : status === 'on_leave'
                      ? { label: 'On leave', variant: 'destructive' as const }
                      : { label: 'Not checked in', variant: 'secondary' as const };
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedRecipients.has(u.id)}
                        onCheckedChange={(c) => toggleRecipient(u.id, c as boolean)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                        {badge.label}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active sales users available.</p>
            )}
            <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> {recipientCount} recipient{recipientCount === 1 ? '' : 's'} selected
            </div>
          </CardContent>
        </Card>
      )}

      {fromUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. What to redistribute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(ENTITY_LABELS) as EntityKey[]).map((k) => (
              <label key={k} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={entities.has(k)}
                  onCheckedChange={(c) => toggleEntity(k, c as boolean)}
                />
                <span className="text-sm">{ENTITY_LABELS[k]}</span>
              </label>
            ))}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Optional — historical authorship (usually leave OFF; new owner sees them via lead/customer link)
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeQuotations} onCheckedChange={(c) => setIncludeQuotations(c as boolean)} />
              <span className="text-sm">Re-stamp Quotation authorship (created_by)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={includeOrders} onCheckedChange={(c) => setIncludeOrders(c as boolean)} />
              <span className="text-sm">Re-stamp Sales Order authorship (created_by)</span>
            </label>
          </CardContent>
        </Card>
      )}

      {fromUserId && perRecipient && totalToMove > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shuffle className="h-4 w-4" /> Preview
            </CardTitle>
            <CardDescription>
              {totalToMove.toLocaleString()} record{totalToMove === 1 ? '' : 's'} across {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Each recipient will get approximately:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {entities.has('leads') && <Badge variant="secondary">~{perRecipient.leads} leads</Badge>}
              {entities.has('customers') && <Badge variant="secondary">~{perRecipient.customers} customers</Badge>}
              {entities.has('escalations') && <Badge variant="secondary">~{perRecipient.escalations} escalations</Badge>}
              {entities.has('tasks') && <Badge variant="secondary">~{perRecipient.tasks} tasks</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/settings')}>Cancel</Button>
        <Button
          disabled={!canRun || redistribute.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {redistribute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Redistribution
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm redistribution</AlertDialogTitle>
            <AlertDialogDescription>
              This will reassign <strong>{totalToMove.toLocaleString()}</strong> records from{' '}
              <strong>{sourceUsers.data?.find((u) => u.id === fromUserId)?.full_name}</strong> across{' '}
              <strong>{recipientCount}</strong> recipient{recipientCount === 1 ? '' : 's'}. A full audit trail
              is recorded. This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRun}>Yes, redistribute</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${muted ? 'opacity-70' : ''}`}>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
