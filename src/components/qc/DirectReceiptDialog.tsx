import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDirectReceipt } from '@/hooks/useQC';
import { requireTenantId } from '@/utils/tenantUtils';

interface Line {
  key: string;
  product_id: string;
  label: string;
  unit: string | null;
  received_quantity: number;
  passed_quantity: number;
  held_quantity: number;
  hold_reason: string;
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  product_id: '',
  label: '',
  unit: null,
  received_quantity: 0,
  passed_quantity: 0,
  held_quantity: 0,
  hold_reason: '',
});

function ProductPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (p: { id: string; label: string; unit: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['qc', 'product-search', debounced],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from('products').select('id, name, model_number, unit').limit(25);
      if (debounced.trim()) {
        const term = `%${debounced.trim()}%`;
        q = q.or(`model_number.ilike.${term},name.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; name: string; model_number: string | null; unit: string | null }[];
    },
  });

  const quickAdd = async () => {
    const model = search.trim();
    if (!model) return;
    setCreating(true);
    try {
      const tenant_id = await requireTenantId();
      const { data, error } = await supabase
        .from('products')
        .insert({ tenant_id, name: model, model_number: model, description: model, unit: 'Nos' })
        .select('id, name, model_number, unit')
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onPick({ id: data.id, label: data.model_number || data.name, unit: data.unit });
      toast.success('Item added to the catalogue');
      setOpen(false);
    } catch (e: any) {
      toast.error('Could not add the item: ' + (e?.message || 'unknown error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          {value || 'Search item…'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Model number or name…" value={search} onValueChange={setSearch} />
          <CommandList>
            {isFetching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
            {!isFetching && results.length === 0 && (
              <CommandEmpty>
                <div className="p-3 space-y-2 text-sm">
                  <div className="text-muted-foreground">No item found.</div>
                  <Button size="sm" disabled={!search.trim() || creating} onClick={quickAdd}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add “{search.trim()}” as a new item
                  </Button>
                </div>
              </CommandEmpty>
            )}
            <CommandGroup>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onPick({ id: p.id, label: p.model_number || p.name, unit: p.unit });
                    setOpen(false);
                  }}
                >
                  <div>
                    <div className="font-medium">{p.model_number || p.name}</div>
                    {p.model_number && p.name !== p.model_number && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{p.name}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {results.length > 0 && search.trim() && (
              <div className="border-t p-2">
                <Button size="sm" variant="ghost" disabled={creating} onClick={quickAdd}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add “{search.trim()}” as a new item
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DirectReceiptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const receive = useDirectReceipt();
  const [officeId, setOfficeId] = useState('');
  const [supplierId, setSupplierId] = useState<string>('none');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['qc', 'suppliers-min'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name').limit(500);
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!officeId && offices.length > 0) setOfficeId(offices[0].id);
  }, [offices, officeId]);

  useEffect(() => {
    if (open) {
      setLines([newLine()]);
      setReference('');
      setNotes('');
      setSupplierId('none');
    }
  }, [open]);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        const received = Math.max(0, Number(next.received_quantity) || 0);
        if (patch.passed_quantity !== undefined) {
          const passed = Math.min(Math.max(0, Number(patch.passed_quantity) || 0), received);
          return { ...next, received_quantity: received, passed_quantity: passed, held_quantity: received - passed };
        }
        const held = Math.min(Math.max(0, Number(next.held_quantity) || 0), received);
        return { ...next, received_quantity: received, held_quantity: held, passed_quantity: received - held };
      }),
    );

  const submit = () => {
    if (!officeId) return;
    receive.mutate(
      {
        office_id: officeId,
        supplier_id: supplierId === 'none' ? null : supplierId,
        reference,
        notes,
        items: lines
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: l.product_id,
            received_quantity: l.received_quantity,
            passed_quantity: l.passed_quantity,
            held_quantity: l.held_quantity,
            hold_reason: l.hold_reason,
          })),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Direct receipt — material without a purchase order</DialogTitle>
          <DialogDescription>
            For replacements, customer returns and opening stock. Passed quantity goes into warehouse stock, held quantity is kept aside.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
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
            <div className="grid gap-2">
              <Label>Supplier (optional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="No supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reference (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Challan / docket no." />
            </div>
          </div>

          <div className="max-h-[40vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28">Received</TableHead>
                  <TableHead className="w-28">Passed</TableHead>
                  <TableHead className="w-28">Held</TableHead>
                  <TableHead className="w-48">Reason for hold</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell className="min-w-[220px]">
                      <ProductPicker
                        value={line.label}
                        onPick={(p) => update(line.key, { product_id: p.id, label: p.label, unit: p.unit })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.received_quantity}
                        onChange={(e) => update(line.key, { received_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.passed_quantity}
                        onChange={(e) => update(line.key, { passed_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.held_quantity}
                        onChange={(e) => update(line.key, { held_quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        disabled={line.held_quantity <= 0}
                        value={line.hold_reason}
                        onChange={(e) => update(line.key, { hold_reason: e.target.value })}
                        placeholder={line.held_quantity > 0 ? 'Why is it held?' : '—'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button variant="outline" size="sm" className="w-fit" onClick={() => setLines((p) => [...p, newLine()])}>
            <Plus className="h-4 w-4 mr-1" />
            Add item
          </Button>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where the material came from, condition…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={receive.isPending || !officeId || !lines.some((l) => l.product_id && l.received_quantity > 0)}>
            {receive.isPending ? 'Saving…' : 'Receive into warehouse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
