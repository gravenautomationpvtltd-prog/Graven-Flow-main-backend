import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, User } from 'lucide-react';
import { useUpsertProcurementTarget, PROCUREMENT_METRICS } from '@/hooks/useProcurementTargets';

interface SetProcurementTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetProcurementTargetsDialog({ open, onOpenChange }: SetProcurementTargetsDialogProps) {
  const currentDate = new Date();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [targets, setTargets] = useState<Record<string, string>>({
    price_resolutions: '',
    products_added: '',
    po_count: '',
    resolution_time_hours: '',
    po_value: '',
  });

  const upsertTarget = useUpsertProcurementTarget();

  // Fetch procurement team members
  const { data: procurementUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['procurement-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profiles:profiles!user_roles_user_id_fkey(id, full_name, is_active)
        `)
        .in('role', ['procurement', 'warehouse', 'manager', 'super_admin', 'coo']);

      if (error) throw error;

      // Dedupe by user_id and filter active users
      const uniqueUsers = new Map();
      data?.forEach((item: any) => {
        if (item.profiles?.is_active && !uniqueUsers.has(item.user_id)) {
          uniqueUsers.set(item.user_id, {
            id: item.user_id,
            full_name: item.profiles.full_name,
          });
        }
      });

      return Array.from(uniqueUsers.values());
    },
  });

  // Load existing targets when user is selected
  const { data: existingTargets } = useQuery({
    queryKey: ['procurement-targets-for-user', selectedUserId, year, month],
    queryFn: async () => {
      if (!selectedUserId) return [];
      
      const { data, error } = await supabase
        .from('procurement_targets')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('year', year)
        .eq('month', month)
        .eq('target_type', 'monthly');

      if (error) throw error;
      return data;
    },
    enabled: !!selectedUserId,
  });

  // Update targets state when existing targets are loaded
  useEffect(() => {
    if (existingTargets && existingTargets.length > 0) {
      const newTargets: Record<string, string> = {
        price_resolutions: '',
        products_added: '',
        po_count: '',
        resolution_time_hours: '',
        po_value: '',
      };
      existingTargets.forEach((t: any) => {
        newTargets[t.metric] = String(t.target_value);
      });
      setTargets(newTargets);
    }
  }, [existingTargets]);

  const handleSave = async () => {
    if (!selectedUserId) return;

    const promises = Object.entries(targets)
      .filter(([, value]) => value !== '' && Number(value) > 0)
      .map(([metric, value]) =>
        upsertTarget.mutateAsync({
          user_id: selectedUserId,
          target_type: 'monthly',
          year,
          month,
          metric: metric as any,
          target_value: Number(value),
        })
      );

    await Promise.all(promises);
    onOpenChange(false);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Procurement Targets</DialogTitle>
          <DialogDescription>
            Assign monthly performance targets to procurement team members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(currentDate.getFullYear() - 1)}>
                    {currentDate.getFullYear() - 1}
                  </SelectItem>
                  <SelectItem value={String(currentDate.getFullYear())}>
                    {currentDate.getFullYear()}
                  </SelectItem>
                  <SelectItem value={String(currentDate.getFullYear() + 1)}>
                    {currentDate.getFullYear() + 1}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label>Team Member</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {loadingUsers ? (
                  <div className="p-2 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  procurementUsers?.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.full_name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Targets Input */}
          {selectedUserId && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                {Object.entries(PROCUREMENT_METRICS).map(([key, config]) => (
                  <div key={key} className="grid grid-cols-2 gap-4 items-center">
                    <Label className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      {config.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={`Target ${config.unit}`}
                        value={targets[key] || ''}
                        onChange={(e) => setTargets({ ...targets, [key]: e.target.value })}
                        min={0}
                      />
                      {config.unit !== 'count' && config.unit !== 'currency' && (
                        <span className="text-sm text-muted-foreground w-12">{config.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!selectedUserId || upsertTarget.isPending}
            >
              {upsertTarget.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Targets
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
