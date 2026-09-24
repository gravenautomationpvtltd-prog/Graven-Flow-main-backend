import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, Plus, ChevronDown, Settings2 } from 'lucide-react';
import { useBoqItems, useUpsertBoqItem, useDeleteBoqItem, type BoqItemCategory } from '@/hooks/useBoqs';
import { ProductSearchCombobox } from '@/components/leads/ProductSearchCombobox';

const CATEGORIES: { value: BoqItemCategory; label: string }[] = [
  { value: 'vfd', label: 'VFD' },
  { value: 'plc', label: 'PLC' },
  { value: 'hmi', label: 'HMI' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'motor', label: 'Motor' },
  { value: 'panel', label: 'Panel' },
  { value: 'cable', label: 'Cable' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
];

interface BoqItemsEditorProps {
  boqId: string;
  readOnly?: boolean;
}

interface DraftSpecs {
  voltage?: string;
  current?: string;
  kw_rating?: string;
  protocol?: string;
  ip_rating?: string;
  mounting_type?: string;
  compliance_standards?: string;
  remarks?: string;
}

export function BoqItemsEditor({ boqId, readOnly }: BoqItemsEditorProps) {
  const { data: items = [], isLoading } = useBoqItems(boqId);
  const upsert = useUpsertBoqItem();
  const del = useDeleteBoqItem();

  const [draft, setDraft] = useState({
    category: 'vfd' as BoqItemCategory,
    description: '',
    hsn: null as string | null,
    product_id: null as string | null,
    model_number: '',
    manufacturer: '',
    quantity: 1,
    unit: 'pcs',
    estimated_unit_price: '',
    specs: {} as DraftSpecs,
  });
  const [specsOpen, setSpecsOpen] = useState(false);

  const updateSpec = (patch: Partial<DraftSpecs>) =>
    setDraft((d) => ({ ...d, specs: { ...d.specs, ...patch } }));

  const handleAdd = async () => {
    if (!draft.description.trim()) return;
    await upsert.mutateAsync({
      boq_id: boqId,
      category: draft.category,
      description: draft.description,
      model_number: draft.model_number || null,
      manufacturer: draft.manufacturer || null,
      quantity: Number(draft.quantity) || 1,
      unit: draft.unit || 'pcs',
      estimated_unit_price: draft.estimated_unit_price ? Number(draft.estimated_unit_price) : null,
      product_id: draft.product_id,
      technical_specs: draft.specs as any,
      sort_order: items.length,
    });
    setDraft({
      category: draft.category,
      description: '',
      hsn: null,
      product_id: null,
      model_number: '',
      manufacturer: '',
      quantity: 1,
      unit: 'pcs',
      estimated_unit_price: '',
      specs: {},
    });
    setSpecsOpen(false);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-left p-2 font-medium">Description / HSN</th>
              <th className="text-left p-2 font-medium">Specs</th>
              <th className="text-right p-2 font-medium">Qty</th>
              <th className="text-right p-2 font-medium">Est. Price</th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">No items yet. Add models below.</td></tr>
            )}
            {items.map((it) => {
              const ts = (it.technical_specs || {}) as DraftSpecs;
              const specChips = [
                ts.kw_rating && `${ts.kw_rating} KW`,
                ts.voltage && `${ts.voltage} V`,
                ts.current && `${ts.current} A`,
                ts.protocol,
                ts.ip_rating,
              ].filter(Boolean) as string[];
              return (
                <tr key={it.id} className="border-t align-top">
                  <td className="p-2 uppercase text-xs">{it.category}</td>
                  <td className="p-2">
                    <div className="font-medium">{it.description}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {it.model_number || '—'}{it.manufacturer ? ` · ${it.manufacturer}` : ''}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {specChips.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : specChips.map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                  <td className="p-2 text-right">{it.estimated_unit_price ? `₹${Math.round(it.estimated_unit_price).toLocaleString('en-IN')}` : '—'}</td>
                  {!readOnly && (
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => del.mutate({ id: it.id, boqId })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Add new item</p>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as BoqItemCategory })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-5">
              {draft.description ? (
                <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-background">
                  <span className="text-sm flex-1 truncate">{draft.description}</span>
                  {draft.hsn && <Badge variant="outline" className="text-xs">{draft.hsn}</Badge>}
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDraft({ ...draft, description: '', hsn: null, product_id: null })}>Change</Button>
                </div>
              ) : (
                <ProductSearchCombobox
                  placeholder="Search HSN / product..."
                  onSelect={(p, custom) => setDraft({ ...draft, description: p?.name || custom || '', hsn: p?.hsn_code || null, product_id: p?.id || null })}
                />
              )}
            </div>
            <Input className="col-span-2" placeholder="Model #" value={draft.model_number} onChange={(e) => setDraft({ ...draft, model_number: e.target.value })} />
            <Input className="col-span-1" type="number" placeholder="Qty" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} />
            <Input className="col-span-2" type="number" placeholder="Price" value={draft.estimated_unit_price} onChange={(e) => setDraft({ ...draft, estimated_unit_price: e.target.value })} />
          </div>

          <Collapsible open={specsOpen} onOpenChange={setSpecsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs">
                <Settings2 className="h-3 w-3 mr-1" /> Technical specs
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${specsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">KW</Label>
                  <Input className="h-9" value={draft.specs.kw_rating || ''} onChange={(e) => updateSpec({ kw_rating: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Voltage</Label>
                  <Input className="h-9" value={draft.specs.voltage || ''} onChange={(e) => updateSpec({ voltage: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Current</Label>
                  <Input className="h-9" value={draft.specs.current || ''} onChange={(e) => updateSpec({ current: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Protocol</Label>
                  <Input className="h-9" value={draft.specs.protocol || ''} onChange={(e) => updateSpec({ protocol: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">IP Rating</Label>
                  <Input className="h-9" value={draft.specs.ip_rating || ''} onChange={(e) => updateSpec({ ip_rating: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Mounting</Label>
                  <Input className="h-9" value={draft.specs.mounting_type || ''} onChange={(e) => updateSpec({ mounting_type: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Compliance</Label>
                  <Input className="h-9" value={draft.specs.compliance_standards || ''} onChange={(e) => updateSpec({ compliance_standards: e.target.value })} />
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">Manufacturer / Brand</Label>
                  <Input className="h-9" value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} />
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">Remarks</Label>
                  <Input className="h-9" value={draft.specs.remarks || ''} onChange={(e) => updateSpec({ remarks: e.target.value })} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button size="sm" onClick={handleAdd} disabled={!draft.description.trim() || upsert.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
          </Button>
        </div>
      )}
    </div>
  );
}
