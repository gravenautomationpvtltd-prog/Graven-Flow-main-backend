import { usePayrollSlabs } from '@/hooks/usePayroll';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function PayrollSlabsTable() {
  const { data: slabs, isLoading } = usePayrollSlabs();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!slabs || slabs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No deduction slabs configured.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Late Range (minutes)</TableHead>
          <TableHead>Deduction Type</TableHead>
          <TableHead className="text-right">Deduction Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slabs.map((slab) => (
          <TableRow key={slab.id}>
            <TableCell className="font-medium">
              {slab.min_late_minutes} - {slab.max_late_minutes === 9999 ? '∞' : slab.max_late_minutes}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {slab.deduction_type === 'fixed' ? 'Fixed Amount' : 'Percentage'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {slab.deduction_type === 'fixed' 
                ? `₹${Number(slab.deduction_value).toLocaleString()}`
                : `${slab.deduction_value}%`
              }
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
