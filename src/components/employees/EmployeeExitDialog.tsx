import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, Target, CheckSquare, Users, UserCheck, X, ChevronDown } from 'lucide-react';
import { useEmployeeWorkSummary, useEmployeeExit } from '@/hooks/useEmployeeExit';
import { useProfiles } from '@/hooks/useProfiles';
import { format } from 'date-fns';

interface EmployeeExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

export function EmployeeExitDialog({ open, onOpenChange, employeeId, employeeName }: EmployeeExitDialogProps) {
  const [exitType, setExitType] = useState<'terminated' | 'resigned'>('resigned');
  const [exitDate, setExitDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exitReason, setExitReason] = useState('');
  const [delegateIds, setDelegateIds] = useState<string[]>([]);

  const { data: workSummary, isLoading: summaryLoading } = useEmployeeWorkSummary(employeeId);
  const { data: allProfiles } = useProfiles();
  const exitMutation = useEmployeeExit();

  // Active employees only: is_active, no exit_date, employment_status active or null
  const availableProfiles = useMemo(
    () =>
      (allProfiles || []).filter((p: any) => {
        if (p.id === employeeId) return false;
        if (p.is_active === false) return false;
        if (p.exit_date) return false;
        const status = p.employment_status ?? 'active';
        return status === 'active';
      }),
    [allProfiles, employeeId]
  );

  const hasWork =
    workSummary &&
    (workSummary.activeLeads > 0 ||
      workSummary.pendingTasks > 0 ||
      workSummary.customers > 0 ||
      workSummary.subordinates > 0);

  const toggleDelegate = (id: string) => {
    setDelegateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedProfiles = useMemo(
    () => availableProfiles.filter((p: any) => delegateIds.includes(p.id)),
    [availableProfiles, delegateIds]
  );

  const handleConfirm = () => {
    if (hasWork && delegateIds.length === 0) return;
    exitMutation.mutate(
      {
        fromUserId: employeeId,
        toUserIds: delegateIds,
        exitType,
        exitDate,
        exitReason,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Offboard Employee
          </DialogTitle>
          <DialogDescription>
            Mark <strong>{employeeName}</strong> as exited and delegate their active work to one or more team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Exit Type</Label>
            <Select value={exitType} onValueChange={(v) => setExitType(v as 'terminated' | 'resigned')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resigned">Resigned</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Exit Date</Label>
            <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Brief reason for exit..."
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Active Work to Delegate</h4>
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>{workSummary?.activeLeads || 0} active leads</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-orange-500" />
                  <span>{workSummary?.pendingTasks || 0} pending tasks</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span>{workSummary?.customers || 0} customers</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-purple-500" />
                  <span>{workSummary?.subordinates || 0} direct reports</span>
                </div>
              </div>
            )}
          </div>

          {hasWork && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Delegate All Work To
              </Label>

              {selectedProfiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProfiles.map((p: any) => (
                    <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                      {p.full_name}
                      <button
                        type="button"
                        onClick={() => toggleDelegate(p.id)}
                        className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`Remove ${p.full_name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {delegateIds.length === 0
                        ? 'Select employees…'
                        : `${delegateIds.length} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <ScrollArea className="h-64">
                    <div className="p-2 space-y-1">
                      {availableProfiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">No active employees available.</p>
                      ) : (
                        availableProfiles.map((p: any) => {
                          const checked = delegateIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                            >
                              <Checkbox checked={checked} onCheckedChange={() => toggleDelegate(p.id)} />
                              <span className="truncate">{p.full_name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {delegateIds.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Work will be split equally (round-robin) across the {delegateIds.length} selected employees.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={exitMutation.isPending || (!!hasWork && delegateIds.length === 0)}
          >
            {exitMutation.isPending ? 'Processing...' : 'Confirm Offboarding'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
