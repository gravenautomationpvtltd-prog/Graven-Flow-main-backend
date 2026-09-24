import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ReleaseOrderRow, useOrderReleaseLines, useReleaseOrderItems } from '@/hooks/useQC';

interface Props {
  order: ReleaseOrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReleaseGoodsDialog({ order, open, onOpenChange }: Props) {
  const { data, isLoading } = useOrderReleaseLines(open ? order?.id ?? null : null);
  const release = useReleaseOrderItems();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [officeId, setOfficeId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!open) return;
    setNotes('');
    setQty({});
  }, [open, order?.id]);

  useEffect(() => {
    if (!officeId && offices.length > 0) setOfficeId(offices[0].id);
  }, [offices, officeId]);

  const lines = data?.lines || [];

  const submit = () => {
    if (!order) return;
    release.mutate(
      {
        order_id: order.id,
        invoice_id: data?.invoice_id ?? null,
        quotation_id: data?.quotation_id ?? null,
        office_id: officeId || null,
        notes,
        lines: lines.map((l) => ({
          source_type: l.source_type,
          source_item_id: l.source_item_id,
          product_id: l.product_id,
          description: l.description,
          ordered_quantity: l.ordered_quantity,
          released_quantity: l.released_quantity,
          quantity: Math.max(
            0,
            Math.min(
              Number(qty[l.source_item_id] ?? l.ordered_quantity - l.released_quantity) || 0,
              l.ordered_quantity - l.released_quantity,
            ),
          ),
        })),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Release goods — {order?.order_number}</DialogTitle>
          <DialogDescription>
            {data?.invoice_number
              ? `Items taken from invoice ${data.invoice_number}.`
              : 'Items taken from the quotation on this order.'}{' '}
            Released quantity leaves warehouse stock straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 max-w-xs">
            <Label>Release from warehouse</Label>
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
                  <TableHead className="w-28">Already out</TableHead>
                  <TableHead className="w-28">In stock</TableHead>
                  <TableHead className="w-32">Release now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                )}
                {!isLoading && lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      This order has no invoice or quotation lines to release.
                    </TableCell>
                  </TableRow>
                )}
                {lines.map((line) => {
                  const balance = line.ordered_quantity - line.released_quantity;
                  return (
                    <TableRow key={line.source_item_id}>
                      <TableCell className="font-medium max-w-[280px]">
                        <div className="line-clamp-2">{line.description}</div>
                        <div className="text-xs text-muted-foreground">{line.unit || ''}</div>
                      </TableCell>
                      <TableCell>{line.ordered_quantity}</TableCell>
                      <TableCell>{line.released_quantity}</TableCell>
                      <TableCell>
                        <Badge variant={line.available_quantity > 0 ? 'secondary' : 'outline'}>
                          {line.available_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={balance}
                          disabled={balance <= 0}
                          value={qty[line.source_item_id] ?? String(Math.max(0, balance))}
                          onChange={(e) => setQty((p) => ({ ...p, [line.source_item_id]: e.target.value }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Handover remarks…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={release.isPending || lines.length === 0}>
            {release.isPending ? 'Releasing…' : 'Release goods'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
