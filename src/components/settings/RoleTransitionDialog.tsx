import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useUsersWithRoles } from '@/hooks/useUserManagement';
import {
  useRoleWorkSummary, useDelegateRoleWork, REQUIRED_DELEGATE_ROLES,
} from '@/hooks/useRoleTransition';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromUser: { id: string; name: string; office_id?: string | null } | null;
  rolesRemoved: AppRole[];
  /** Called after successful reassignment (parent then persists role changes). */
  onConfirmed: () => void;
}

const WORK_LABELS: Record<string, string> = {
  leads: 'Active leads (qualified)',
  unqualified_leads: 'Unqualified leads',
  customers: 'Owned customers',
  quotations: 'Open quotations',
  sales_orders: 'Active sales orders',
  tasks: 'Lead-related tasks',
  cro_assignments: 'CRO callbacks',
  subordinates: 'Direct reports',
  price_requests: 'Open price requests',
  purchase_orders: 'Draft purchase orders',
  dispatches: 'Open dispatches',
  escalations: 'Open escalations',
  reminders: 'Personal reminders',
};

export function RoleTransitionDialog({
  open, onOpenChange, fromUser, rolesRemoved, onConfirmed,
}: Props) {
  const [delegateId, setDelegateId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { data: summary, isLoading: summaryLoading } = useRoleWorkSummary(fromUser?.id, rolesRemoved);
  const { data: allUsers } = useUsersWithRoles();
  const delegate = useDelegateRoleWork();

  // Required delegate roles = union across removed roles
  const requiredRoles = useMemo(() => {
    const set = new Set<AppRole>();
    rolesRemoved.forEach((r) => {
      (REQUIRED_DELEGATE_ROLES[r] ?? []).forEach((rr) => set.add(rr));
    });
    return Array.from(set);
  }, [rolesRemoved]);

  const eligibleDelegates = useMemo(() => {
    if (!allUsers || !fromUser) return [];
    return allUsers
      .filter((u) =>
        u.id !== fromUser.id &&
        u.is_active &&
        (requiredRoles.length === 0 || u.roles.some((r) => requiredRoles.includes(r)))
      )
      .sort((a, b) => {
        // prefer same office
        const aSame = fromUser.office_id && a.office_id === fromUser.office_id ? 0 : 1;
        const bSame = fromUser.office_id && b.office_id === fromUser.office_id ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
  }, [allUsers, fromUser, requiredRoles]);

  const totalItems = summary?.total ?? 0;
  const hasWork = totalItems > 0;

  const handleConfirm = async () => {
    if (!fromUser) return;
    if (hasWork && !delegateId) return;

    if (hasWork) {
      await delegate.mutateAsync({
        fromUserId: fromUser.id,
        toUserId: delegateId,
        rolesRemoved,
        notes: notes.trim() || undefined,
      });
    }
    onConfirmed();
    setDelegateId('');
    setNotes('');
  };

  const handleSkip = () => {
    onConfirmed();
    setDelegateId('');
    setNotes('');
  };

  if (!fromUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Role Transition Handover
          </DialogTitle>
          <DialogDescription>
            You are removing role(s){' '}
            {rolesRemoved.map((r) => (
              <Badge key={r} variant="secondary" className="mx-0.5">{r}</Badge>
            ))}{' '}
            from <strong>{fromUser.name}</strong>. Reassign their open work before saving.
          </DialogDescription>
        </DialogHeader>

        {summaryLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculating open work…
          </div>
        ) : !hasWork ? (
          <Alert>
            <AlertTitle>No active work to transfer</AlertTitle>
            <AlertDescription>
              This user has no open items tied to the removed role(s). You can save the role change directly.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertTitle>{totalItems} item{totalItems === 1 ? '' : 's'} need a new owner</AlertTitle>
              <AlertDescription>
                Pick a delegate who already has the required role. Items will be reassigned immediately.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 py-2">
              {Object.entries(WORK_LABELS).map(([key, label]) => {
                const n = (summary as any)?.[key] ?? 0;
                if (n === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant="outline">{n}</Badge>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label>Delegate (must hold: {requiredRoles.join(', ') || 'any role'})</Label>
              {eligibleDelegates.length === 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    No eligible delegate found. Promote or invite a user with one of the required roles before removing this role.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={delegateId} onValueChange={setDelegateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delegate…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleDelegates.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                        {fromUser.office_id && u.office_id === fromUser.office_id && (
                          <span className="ml-2 text-xs text-muted-foreground">(same office)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Handover notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context for the delegate…"
                rows={2}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={delegate.isPending}>
            Cancel
          </Button>
          {hasWork ? (
            <Button
              onClick={handleConfirm}
              disabled={delegate.isPending || !delegateId || eligibleDelegates.length === 0}
            >
              {delegate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reassign & Save <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSkip}>
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
