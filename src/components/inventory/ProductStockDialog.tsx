import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdjustStock } from '@/hooks/useInventory';
import { Plus, Minus, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productLabel: string;
  unit?: string | null;
}

/**
 * Adjust warehouse stock straight from a product (catalogue or product page),
 * including products that have no stock line yet — the office is picked here.
 */
export function ProductStockDialog({ open, onOpenChange, productId, productLabel, unit }: ProductStockDialogProps) {
  const [officeId, setOfficeId] = useState<string>('');
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const adjustStock = useAdjustStock();

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: open,
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['inventory', 'product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('office_id, quantity')
        .eq('product_id', productId);
      if (error) throw error;
      return (data || []) as { office_id: string; quantity: number }[];
    },
    enabled: open && !!productId,
  });

  useEffect(() => {
    if (!open) return;
    if (officeId) return;
    const withStock = [...rows].sort((a, b) => b.quantity - a.quantity)[0];
    setOfficeId(withStock?.office_id || offices[0]?.id || '');
  }, [open, rows, offices, officeId]);

  const currentQty = useMemo(
    () => rows.find((r) => r.office_id === officeId)?.quantity ?? 0,
    [rows, officeId],
  );

  const qty = parseFloat(quantity) || 0;
  const newQuantity =
    movementType === 'in' ? currentQty + qty : movementType === 'out' ? currentQty - qty : qty;
  const goesNegative = newQuantity < 0;
  const isValid = !!officeId && qty > 0 && !goesNegative;

  const reset = () => {
    setMovementType('in');
    setQuantity('');
    setNotes('');
    setOfficeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    await adjustStock.mutateAsync({
      product_id: productId,
      office_id: officeId,
      adjustment: qty,
      movement_type: movementType,
      notes: notes || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>{productLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Warehouse</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => {
                  const q = rows.find((r) => r.office_id === o.id)?.quantity ?? 0;
                  return (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {q} {unit || 'Nos'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current stock here: {currentQty} {unit || 'Nos'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Movement type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={movementType === 'in' ? 'default' : 'outline'}
                className={cn('gap-2', movementType === 'in' && 'bg-green-600 hover:bg-green-700')}
                onClick={() => setMovementType('in')}
              >
                <Plus className="h-4 w-4" />Stock In
              </Button>
              <Button
                type="button"
                variant={movementType === 'out' ? 'default' : 'outline'}
                className={cn('gap-2', movementType === 'out' && 'bg-red-600 hover:bg-red-700')}
                onClick={() => setMovementType('out')}
              >
                <Minus className="h-4 w-4" />Stock Out
              </Button>
              <Button
                type="button"
                variant={movementType === 'adjustment' ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setMovementType('adjustment')}
              >
                <RefreshCw className="h-4 w-4" />Set To
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pq">{movementType === 'adjustment' ? 'New quantity' : 'Quantity'}</Label>
            <Input
              id="pq"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={cn(goesNegative && 'border-destructive')}
            />
            {qty > 0 && (
              <p className={cn('text-sm', goesNegative ? 'text-destructive' : 'text-muted-foreground')}>
                New stock level: <span className="font-semibold">{newQuantity} {unit || 'Nos'}</span>
              </p>
            )}
            {goesNegative && (
              <p className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />Stock cannot go negative.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pn">Notes (optional)</Label>
            <Textarea id="pn" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for adjustment..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!isValid || adjustStock.isPending}>
              {adjustStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
