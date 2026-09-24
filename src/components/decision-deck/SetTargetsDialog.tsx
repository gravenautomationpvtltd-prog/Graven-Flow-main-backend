import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSalesTargets, useUpsertTarget } from '@/hooks/useSalesTargets';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import { Loader2, Save } from 'lucide-react';

interface SetTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function SetTargetsDialog({ open, onOpenChange }: SetTargetsDialogProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [targetValues, setTargetValues] = useState<Record<string, string>>({});

  const { data: offices, isLoading: officesLoading } = useOfficesManagement();
  const { data: existingTargets, isLoading: targetsLoading } = useSalesTargets(year, month);
  const upsertTarget = useUpsertTarget();

  useEffect(() => {
    if (existingTargets && offices) {
      const values: Record<string, string> = {};
      offices.forEach(office => {
        const target = existingTargets.find(t => t.office_id === office.id);
        values[office.id] = target ? String(target.target_amount) : '';
      });
      setTargetValues(values);
    }
  }, [existingTargets, offices]);

  const handleSave = async (officeId: string) => {
    const amount = parseFloat(targetValues[officeId] || '0');
    if (amount >= 0) {
      await upsertTarget.mutateAsync({
        office_id: officeId,
        target_type: 'monthly',
        year,
        month,
        target_amount: amount,
      });
    }
  };

  const handleSaveAll = async () => {
    for (const office of offices || []) {
      const amount = parseFloat(targetValues[office.id] || '0');
      if (amount >= 0) {
        await upsertTarget.mutateAsync({
          office_id: office.id,
          target_type: 'monthly',
          year,
          month,
          target_amount: amount,
        });
      }
    }
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const isLoading = officesLoading || targetsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set Sales Targets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Target Amount (₹)</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(offices || []).map(office => (
                  <TableRow key={office.id}>
                    <TableCell className="font-medium">{office.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={targetValues[office.id] || ''}
                        onChange={(e) => setTargetValues(prev => ({
                          ...prev,
                          [office.id]: e.target.value
                        }))}
                        placeholder="Enter target amount"
                        className="max-w-[200px]"
                      />
                      {targetValues[office.id] && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {formatCurrency(parseFloat(targetValues[office.id] || '0'))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(office.id)}
                        disabled={upsertTarget.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAll} disabled={upsertTarget.isPending}>
              {upsertTarget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Targets
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
