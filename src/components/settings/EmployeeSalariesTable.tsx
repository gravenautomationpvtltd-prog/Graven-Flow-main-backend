import { useState } from 'react';
import { useEmployeeSalaries, useUpdateEmployeeSalary } from '@/hooks/usePayroll';
import { useProfiles } from '@/hooks/useProfiles';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Edit, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';

export function EmployeeSalariesTable() {
  const { data: salaries, isLoading } = useEmployeeSalaries();
  const { data: profiles } = useProfiles();
  const updateSalary = useUpdateEmployeeSalary();
  
  const [showDialog, setShowDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [baseSalary, setBaseSalary] = useState('');

  const handleSave = () => {
    if (selectedUserId && baseSalary) {
      updateSalary.mutate(
        { userId: selectedUserId, baseSalary: Number(baseSalary) },
        { onSuccess: () => {
          setShowDialog(false);
          setSelectedUserId('');
          setBaseSalary('');
        }}
      );
    }
  };

  const handleEdit = (userId: string, currentSalary: number) => {
    setSelectedUserId(userId);
    setBaseSalary(currentSalary.toString());
    setShowDialog(true);
  };

  const handleAdd = () => {
    setSelectedUserId('');
    setBaseSalary('');
    setShowDialog(true);
  };

  // Get profiles without configured salary
  const profilesWithoutSalary = profiles?.filter(
    p => !salaries?.some(s => s.user_id === p.id)
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAdd} disabled={profilesWithoutSalary.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Add Salary
        </Button>
      </div>

      {salaries && salaries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Base Salary</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaries.map((salary) => (
              <TableRow key={salary.id}>
                <TableCell className="font-medium">
                  {salary.profiles?.full_name || 'Unknown'}
                </TableCell>
                <TableCell>{salary.profiles?.email}</TableCell>
                <TableCell className="text-right">
                  ₹{Number(salary.base_salary).toLocaleString()}
                </TableCell>
                <TableCell>
                  {format(new Date(salary.effective_from), 'dd MMM yyyy')}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(salary.user_id, Number(salary.base_salary))}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No employee salaries configured yet.
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUserId && salaries?.some(s => s.user_id === selectedUserId) 
                ? 'Edit Salary' 
                : 'Add Salary'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!salaries?.some(s => s.user_id === selectedUserId) && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {profilesWithoutSalary.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Base Salary (₹)</Label>
              <Input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="Enter base salary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!selectedUserId || !baseSalary || updateSalary.isPending}
            >
              {updateSalary.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
