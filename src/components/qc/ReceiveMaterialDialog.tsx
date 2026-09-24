import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PendingPO, ReceiveLine, useReceiveMaterial } from '@/hooks/useQC';

interface Props {
  po: PendingPO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiveMaterialDialog({ po, open, onOpenChange }: Props) {
  const receive = useReceiveMaterial();
  const [officeId, setOfficeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!open || !po) return;
    setNotes('');
    setLines(
      (po.items || [])
        .filter((i) => Number(i.received_quantity || 0) < Number(i.quantity || 0))
        .map((i) => {
          const pending = Number(i.quantity || 0) - Number(i.received_quantity || 0);
          return {
            po_item_id: i.id,
            product_id: i.product_id,
            ordered_quantity: Number(i.quantity || 0),
            received_quantity: pending,
            passed_quantity: pending,
            held_quantity: 0,
            hold_reason: '',
          };
        }),
    );
  }, [open, po]);

  useEffect(() => {
    if (!officeId && offices.length > 0) setOfficeId(offices[0].id);
  }, [offices, officeId]);

  const productById = useMemo(() => {
    const map: Record<string, { name: string; model: string | null; unit: string | null }> = {};
    (po?.items || []).forEach((i) => {
      map[i.id] = {
        name: i.product?.name || 'Item',
        model: i.product?.model_number ?? null,
        unit: i.product?.unit ?? null,
      };
    });
    return map;
  }, [po]);

  const update = (index: number, patch: Partial<ReceiveLine>) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        const received = Math.max(0, Number(next.received_quantity) || 0);
        let held = Math.min(Math.max(0, Number(next.held_quantity) || 0), received);
        if (patch.passed_quantity !== undefined) {
          const passed = Math.min(Math.max(0, Number(patch.passed_quantity) || 0), received);
          held = received - passed;
          return { ...next, received_quantity: received, passed_quantity: passed, held_quantity: held };
        }
        return { ...next, received_quantity: received, held_quantity: held, passed_quantity: received - held };
      }),
    );
  };

  const submit = () => {
    if (!po || !officeId) return;
    receive.mutate(
      { po_id: po.id, supplier_id: po.supplier_id, office_id: officeId, notes, items: lines },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const totals = lines.reduce(
    (acc, l) => ({
      received: acc.received + Number(l.received_quantity || 0),
      passed: acc.passed + Number(l.passed_quantity || 0),
      held: acc.held + Number(l.held_quantity || 0),
    }),
    { received: 0, passed: 0, held: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Receive &amp; check material — {po?.po_number}</DialogTitle>
          <DialogDescription>
            Passed quantity goes straight into warehouse stock. Held quantity is kept aside and can never be sold.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 max-w-xs">
            <Label>Warehouse</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[45vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Ordered</TableHead>
                  <TableHead className="w-28">Received</TableHead>
                  <TableHead className="w-28">Passed</TableHead>
                  <TableHead className="w-28">Held</TableHead>
                  <TableHead className="w-56">Reason for hold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={line.po_item_id}>
                    <TableCell className="font-medium">
                      {productById[line.po_item_id]?.model || productById[line.po_item_id]?.name}
                      <div className="text-xs text-muted-foreground">{productById[line.po_item_id]?.unit || ''}</div>
                    </TableCell>
                    <TableCell>{line.ordered_quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.received_quantity}
                        onChange={(e) => update(index, { received_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.passed_quantity}
                        onChange={(e) => update(index, { passed_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.held_quantity}
                        onChange={(e) => update(index, { held_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder={line.held_quantity > 0 ? 'Why is it held?' : '—'}
                        disabled={line.held_quantity <= 0}
                        value={line.hold_reason || ''}
                        onChange={(e) => update(index, { hold_reason: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nothing pending on this purchase order.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Received {totals.received} · Passed into stock {totals.passed} · Held {totals.held}
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Check observations, damage, packaging…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={receive.isPending || lines.length === 0 || !officeId}>
            {receive.isPending ? 'Saving…' : 'Record receipt & check'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
