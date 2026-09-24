import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBulkUpdate } from '@/hooks/useBulkActions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onDone?: () => void;
}

export function ProductBulkEditDialog({ open, onOpenChange, productIds, onDone }: Props) {
  const bulkUpdate = useBulkUpdate();
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('keep');
  const [unit, setUnit] = useState('');
  const [taxRate, setTaxRate] = useState('');

  useEffect(() => {
    if (open) {
      setBrand('');
      setStatus('keep');
      setUnit('');
      setTaxRate('');
    }
  }, [open]);

  const submit = async () => {
    const updates: Record<string, unknown> = {};
    if (brand.trim()) updates.brand = brand.trim();
    if (status !== 'keep') updates.product_status = status;
    if (unit.trim()) updates.unit = unit.trim();
    if (taxRate.trim()) updates.tax_rate = Number(taxRate);
    if (!Object.keys(updates).length) return;

    await bulkUpdate.mutateAsync({
      table: 'products',
      ids: productIds,
      updates,
      entityType: 'product',
    });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk edit products</DialogTitle>
          <DialogDescription>
            Leave a field blank to keep it unchanged. {productIds.length} product
            {productIds.length === 1 ? '' : 's'} selected.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-brand">Brand</Label>
            <Input id="bulk-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep current</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
                <SelectItem value="obsolete">Obsolete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-unit">Unit</Label>
              <Input id="bulk-unit" placeholder="Nos" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-gst">GST %</Label>
              <Input id="bulk-gst" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={bulkUpdate.isPending}>Apply to {productIds.length}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
