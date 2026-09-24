import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBIETeam } from '@/hooks/useBIEWork';
import {
  PRODUCT_TASK_TYPES,
  useAssignProductWork,
  type ProductTaskType,
} from '@/hooks/useProductAssignments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onAssigned?: () => void;
}

const priorities = ['low', 'normal', 'high', 'urgent'];

export function AssignProductWorkDialog({ open, onOpenChange, productIds, onAssigned }: Props) {
  const { data: people = [] } = useBIETeam();
  const assign = useAssignProductWork();

  const [assignedTo, setAssignedTo] = useState('');
  const [taskType, setTaskType] = useState<ProductTaskType>('update_pricing');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setPriority('normal');
      setDueDate('');
      setNote('');
    }
  }, [open]);

  const submit = async () => {
    await assign.mutateAsync({ productIds, assignedTo, taskType, priority, dueDate, note });
    onOpenChange(false);
    onAssigned?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign product work</DialogTitle>
          <DialogDescription>
            {productIds.length} product{productIds.length === 1 ? '' : 's'} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Choose a team member" /></SelectTrigger>
              <SelectContent>
                {people.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">No team members found</div>
                )}
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name || person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Task</Label>
            <Select value={taskType} onValueChange={(value) => setTaskType(value as ProductTaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_TASK_TYPES.map((task) => (
                  <SelectItem key={task.value} value={task.value}>{task.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-due">Due date</Label>
              <Input id="assign-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-note">Note</Label>
            <Textarea id="assign-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!assignedTo || assign.isPending}>
            Assign {productIds.length} product{productIds.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
