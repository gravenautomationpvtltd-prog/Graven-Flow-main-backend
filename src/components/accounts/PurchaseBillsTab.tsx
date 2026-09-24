import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { usePurchaseBills, useDeletePurchaseBill } from '@/hooks/useBooks';
import { PurchaseBillDialog } from './PurchaseBillDialog';
import { RowActions } from './RowActions';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import { formatINR } from '@/lib/financial-statements';
import { useAuth } from '@/hooks/useAuth';

export function PurchaseBillsTab() {
  const { data: bills = [], isLoading } = usePurchaseBills();
  const del = useDeletePurchaseBill();
  const { isAccounts, isProcurement, isAdmin } = useAuth();
  const canEdit = isAccounts || isProcurement || isAdmin;
  const canDelete = isAccounts || isAdmin;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Purchase bills</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier tax invoices — these feed input credit and the purchase register.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Record bill
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>}
            {!isLoading && !bills.length && (
              <TableRow><TableCell colSpan={8}>No purchase bills yet. Record your first supplier invoice.</TableCell></TableRow>
            )}
            {bills.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.bill_number}</TableCell>
                <TableCell>{b.bill_date}</TableCell>
                <TableCell>{b.supplier?.name ?? b.supplier_name ?? '—'}</TableCell>
                <TableCell>{b.supplier_gstin ?? '—'}</TableCell>
                <TableCell className="text-right">{formatINR(Number(b.subtotal))}</TableCell>
                <TableCell className="text-right">
                  {formatINR(Number(b.total_tax))}
                  {b.itc_eligible === false && <Badge variant="outline" className="ml-2">No ITC</Badge>}
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(Number(b.grand_total))}</TableCell>
                <TableCell className="text-right">
                  <RowActions
                    onView={() => { setEditing(b); setOpen(true); }}
                    onEdit={canEdit ? () => { setEditing(b); setOpen(true); } : undefined}
                    onDelete={canDelete ? () => setDeleting(b) : undefined}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <PurchaseBillDialog open={open} onOpenChange={setOpen} bill={editing} />

      <DoubleConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={async () => { if (deleting) await del.mutateAsync(deleting.id); setDeleting(null); }}
        title="Delete purchase bill"
        description="This removes the bill and its entries from the books."
        itemDetails={deleting && (
          <>
            <p><strong>Bill:</strong> {deleting.bill_number}</p>
            <p><strong>Supplier:</strong> {deleting.supplier?.name ?? deleting.supplier_name ?? '—'}</p>
            <p><strong>Date:</strong> {deleting.bill_date}</p>
            <p><strong>Total:</strong> {formatINR(Number(deleting.grand_total))}</p>
          </>
        )}
        isLoading={del.isPending}
      />
    </Card>
  );
}
