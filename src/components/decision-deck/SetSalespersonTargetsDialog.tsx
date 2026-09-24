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
import { useSalespersonTargets, useUpsertSalespersonTarget, SALESPERSON_METRICS, SalespersonMetricKey } from '@/hooks/useSalespersonTargets';

interface SetSalespersonTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetSalespersonTargetsDialog({ open, onOpenChange }: SetSalespersonTargetsDialogProps) {
  const currentDate = new Date();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [targets, setTargets] = useState<Record<string, string>>({
    leads_converted: '',
    sales_value: '',
    customers_added: '',
    quotations_sent: '',
    orders_count: '',
  });

  const upsertTarget = useUpsertSalespersonTarget();

  // Fetch sales team members
  const { data: salesUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['sales-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profiles:profiles!user_roles_user_id_fkey(id, full_name, is_active)
        `)
        .in('role', ['sales', 'manager', 'super_admin', 'coo']);

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
  const { data: existingTargets } = useSalespersonTargets(selectedUserId || undefined, year, month);

  // Update targets state when existing targets are loaded
  useEffect(() => {
    if (existingTargets && existingTargets.length > 0) {
      const newTargets: Record<string, string> = {
        leads_converted: '',
        sales_value: '',
        customers_added: '',
        quotations_sent: '',
        orders_count: '',
      };
      existingTargets.forEach((t: any) => {
        if (t.metric) {
          newTargets[t.metric] = String(t.target_amount);
        }
      });
      setTargets(newTargets);
    } else if (selectedUserId) {
      // Reset targets when switching to a user with no existing targets
      setTargets({
        leads_converted: '',
        sales_value: '',
        customers_added: '',
        quotations_sent: '',
        orders_count: '',
      });
    }
  }, [existingTargets, selectedUserId]);

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
          metric: metric as SalespersonMetricKey,
          target_amount: Number(value),
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
          <DialogTitle>Set Salesperson Targets</DialogTitle>
          <DialogDescription>
            Assign monthly performance targets to sales team members
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
            <Label>Salesperson</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                {loadingUsers ? (
                  <div className="p-2 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : (
                  salesUsers?.map((user: any) => (
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
                {Object.entries(SALESPERSON_METRICS).map(([key, config]) => (
                  <div key={key} className="grid grid-cols-2 gap-4 items-center">
                    <Label className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      {config.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={config.unit === 'currency' ? 'Target ₹' : 'Target'}
                        value={targets[key] || ''}
                        onChange={(e) => setTargets({ ...targets, [key]: e.target.value })}
                        min={0}
                      />
                      {config.unit === 'currency' && (
                        <span className="text-sm text-muted-foreground w-8">₹</span>
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
