import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProductSearchCombobox } from './ProductSearchCombobox';
import { BrandCombobox } from '@/components/enquiries/BrandCombobox';
import {
  useQualifyLead,
  useLeadQualification,
  type QualificationType,
  type RoutingTarget,
  type QualifyItemInput,
} from '@/hooks/useLeadQualification';
import type { BoqItemCategory } from '@/hooks/useBoqs';
import { CheckCircle2, Cog, XCircle, Plus, Trash2, ChevronDown, Settings2, Paperclip, X, Zap, Hourglass } from 'lucide-react';

interface QualifyLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
}

const TYPE_TO_ROUTE: Record<QualificationType, RoutingTarget> = {
  simple: 'spt',
  technical: 'tst',
  invalid: 'discard',
};

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

interface RowState extends QualifyItemInput {
  _key: string;
  _hsn?: string | null;
  _expanded?: boolean;
  _files?: File[];
}

const emptyRow = (): RowState => ({
  _key: crypto.randomUUID(),
  product_id: null,
  product_query_text: '',
  hsn_code: null,
  quantity: 1,
  notes: '',
  brand: '',
  specifications: {},
  category: 'other',
  _files: [],
});

export function QualifyLeadDialog({ open, onOpenChange, leadId }: QualifyLeadDialogProps) {
  const { data: existing } = useLeadQualification(leadId);
  const qualify = useQualifyLead();

  const [type, setType] = useState<QualificationType>('simple');
  const [routedTo, setRoutedTo] = useState<RoutingTarget>('spt');
  const [reason, setReason] = useState('');
  const [timeline, setTimeline] = useState('');
  const [siteContext, setSiteContext] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<RowState[]>([emptyRow()]);

  useEffect(() => {
    if (open) {
      if (existing) {
        setType(existing.qualification_type);
        setRoutedTo(existing.routed_to);
        setReason(existing.decision_reason || '');
        setTimeline(existing.estimated_timeline || '');
        setNotes(existing.notes || '');
      } else {
        setType('simple');
        setRoutedTo('spt');
        setReason('');
        setTimeline('');
        setSiteContext('');
        setNotes('');
        setRows([emptyRow()]);
      }
    }
  }, [existing, open]);

  const handleTypeChange = (val: QualificationType) => {
    setType(val);
    setRoutedTo(TYPE_TO_ROUTE[val]);
  };

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };

  const updateSpec = (key: string, patch: Partial<NonNullable<RowState['specifications']>>) => {
    setRows((rs) =>
      rs.map((r) =>
        r._key === key ? { ...r, specifications: { ...(r.specifications || {}), ...patch } } : r
      )
    );
  };

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (key: string) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r._key !== key)));

  const validateAndSubmit = async () => {
    if (type === 'invalid') {
      await qualify.mutateAsync({
        lead_id: leadId,
        qualification_type: 'invalid',
        routed_to: routedTo,
        decision_reason: reason || undefined,
        notes: notes || undefined,
      });
      onOpenChange(false);
      return;
    }

    const cleanRows = rows.filter((r) => r.product_query_text.trim() && r.quantity > 0);
    if (cleanRows.length === 0) {
      // toast handled by mutation; surface here too
      return;
    }
    // Require brand for free-text items so procurement routing is deterministic
    const missingBrand = cleanRows.find((r) => !r.product_id && !(r.brand || '').trim());
    if (missingBrand) {
      const { toast } = await import('sonner');
      toast.error('Each free-text item needs a Make / Brand for routing (or pick from catalog)');
      return;
    }
    if (type === 'technical') {
      const ok = cleanRows.every((r) => (r.specifications?.kw_rating || '').trim() || (r.notes || '').trim());
      if (!ok) {
        // soft warn via reason field requirement; let user know via toast
        const { toast } = await import('sonner');
        toast.error('Each technical item needs at least KW rating or application notes');
        return;
      }
    }

    const items: QualifyItemInput[] = cleanRows.map((r) => ({
      product_id: r.product_id,
      product_query_text: r.product_query_text,
      hsn_code: r._hsn || null,
      quantity: Number(r.quantity) || 1,
      notes: r.notes || undefined,
      brand: (r.brand || '').trim() || undefined,
      specifications: type === 'technical' ? r.specifications : undefined,
      category: type === 'technical' ? r.category : undefined,
      attachments: r._files && r._files.length > 0 ? r._files : undefined,
    }));

    const combinedNotes = type === 'technical' && siteContext
      ? `${notes ? notes + '\n\n' : ''}Site context: ${siteContext}`
      : notes;

    await qualify.mutateAsync({
      lead_id: leadId,
      qualification_type: type,
      routed_to: routedTo,
      decision_reason: reason || undefined,
      estimated_timeline: timeline || undefined,
      notes: combinedNotes || undefined,
      items,
    });
    onOpenChange(false);
  };

  const isTechnical = type === 'technical';
  const isInvalid = type === 'invalid';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Update Qualification' : 'Qualify Lead'}</DialogTitle>
          <DialogDescription>
            Capture the enquiry items, then route to Sales (SPT) or Technical (TST).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Outcome */}
          <div>
            <Label className="mb-2 block">Qualification Outcome</Label>
            <RadioGroup value={type} onValueChange={(v) => handleTypeChange(v as QualificationType)} className="grid grid-cols-3 gap-2">
              <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="simple" className="mt-1" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> Simple → SPT
                  </div>
                  <p className="text-xs text-muted-foreground">Standard product, ready for sales</p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="technical" className="mt-1" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <Cog className="h-4 w-4 text-indigo-600" /> Technical → TST
                  </div>
                  <p className="text-xs text-muted-foreground">Needs spec sheet / BOQ</p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
                <RadioGroupItem value="invalid" className="mt-1" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <XCircle className="h-4 w-4 text-destructive" /> Invalid
                  </div>
                  <p className="text-xs text-muted-foreground">Discard or nurture later</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Invalid path */}
          {isInvalid && (
            <div className="space-y-3">
              <div>
                <Label>Route to</Label>
                <Select value={routedTo} onValueChange={(v) => setRoutedTo(v as RoutingTarget)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discard">Discard</SelectItem>
                    <SelectItem value="nurture">Nurture (re-engage later)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why this decision?" />
              </div>
            </div>
          )}

          {/* Items table — Simple & Technical */}
          {!isInvalid && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">Enquiry Items</Label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3 w-3 text-emerald-600" /> Catalog product = Fast Mode
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Hourglass className="h-3 w-3 text-amber-600" /> Free text = Procurement request
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={addRow} className="ml-2">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {rows.map((row, idx) => {
                  const hasProduct = !!row.product_id;
                  const hasText = !!row.product_query_text?.trim();
                  return (
                  <div key={row._key} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    {hasText && (
                      <div className="ml-7">
                        {hasProduct ? (
                          <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            <Zap className="h-2.5 w-2.5 mr-1" /> Fast Mode — auto-priced from catalog
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                            <Hourglass className="h-2.5 w-2.5 mr-1" /> Will request price from Procurement (3h TAT)
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-2 font-mono w-5">{idx + 1}.</span>
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-7">
                          {row.product_query_text ? (
                            <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
                              <span className="text-sm flex-1 truncate">{row.product_query_text}</span>
                              {row._hsn && <Badge variant="outline" className="text-xs">{row._hsn}</Badge>}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => updateRow(row._key, { product_id: null, product_query_text: '', _hsn: null })}
                              >
                                Change
                              </Button>
                            </div>
                          ) : (
                            <ProductSearchCombobox
                              placeholder="Search HSN code or product..."
                              onSelect={(p, custom) =>
                                updateRow(row._key, {
                                  product_id: p?.id || null,
                                  product_query_text: p?.name || custom || '',
                                  _hsn: p?.hsn_code || null,
                                  // Auto-fill brand from catalog product (if not already set by user)
                                  brand: p?.brand && !(row.brand || '').trim() ? p.brand : row.brand,
                                })
                              }
                            />
                          )}
                        </div>
                        <Input
                          className="col-span-2"
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => updateRow(row._key, { quantity: Number(e.target.value) })}
                        />
                        {isTechnical ? (
                          <Input
                            className="col-span-2"
                            placeholder="KW"
                            value={row.specifications?.kw_rating || ''}
                            onChange={(e) => updateSpec(row._key, { kw_rating: e.target.value })}
                          />
                        ) : (
                          <Input
                            className="col-span-2"
                            placeholder="Notes"
                            value={row.notes || ''}
                            onChange={(e) => updateRow(row._key, { notes: e.target.value })}
                          />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="col-span-1"
                          onClick={() => removeRow(row._key)}
                          disabled={rows.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Make / Brand — drives procurement routing */}
                    <div className="ml-7">
                      <BrandCombobox
                        value={row.brand || ''}
                        onChange={(b) => updateRow(row._key, { brand: b })}
                        required={!row.product_id}
                        placeholder="Make / Brand (e.g. Siemens, ABB)…"
                      />
                    </div>

                    {/* Per-item file attachments */}
                    <div className="ml-7">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>Attach files</span>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.doc,.docx"
                            onChange={(e) => {
                              const newFiles = Array.from(e.target.files || []);
                              if (newFiles.length === 0) return;
                              const valid = newFiles.filter((f) => f.size <= 20 * 1024 * 1024);
                              if (valid.length < newFiles.length) {
                                import('sonner').then(({ toast }) => toast.error('Some files exceeded 20MB and were skipped'));
                              }
                              const combined = [...(row._files || []), ...valid].slice(0, 10);
                              updateRow(row._key, { _files: combined });
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {(row._files || []).map((f, i) => (
                          <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1 text-xs font-normal">
                            <span className="max-w-[140px] truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row._key, {
                                  _files: (row._files || []).filter((_, idx) => idx !== i),
                                })
                              }
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Tech expandable specs */}
                    {isTechnical && (
                      <Collapsible
                        open={row._expanded}
                        onOpenChange={(o) => updateRow(row._key, { _expanded: o })}
                      >
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs ml-7">
                            <Settings2 className="h-3 w-3 mr-1" />
                            Technical specs
                            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${row._expanded ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="ml-7 mt-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Category</Label>
                              <Select
                                value={row.category}
                                onValueChange={(v) => updateRow(row._key, { category: v as BoqItemCategory })}
                              >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Voltage</Label>
                              <Input className="h-9" value={row.specifications?.voltage || ''} onChange={(e) => updateSpec(row._key, { voltage: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Current</Label>
                              <Input className="h-9" value={row.specifications?.current || ''} onChange={(e) => updateSpec(row._key, { current: e.target.value })} />
                            </div>
                            <div className="col-span-3">
                              <Label className="text-xs">Application</Label>
                              <Input className="h-9" placeholder="e.g. Conveyor drive, Pump control" value={row.notes || ''} onChange={(e) => updateRow(row._key, { notes: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Brand</Label>
                              <Input className="h-9" value={row.specifications?.brand || ''} onChange={(e) => updateSpec(row._key, { brand: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Model #</Label>
                              <Input className="h-9" value={row.specifications?.model_number || ''} onChange={(e) => updateSpec(row._key, { model_number: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Protocol</Label>
                              <Input className="h-9" placeholder="Modbus, Profinet..." value={row.specifications?.protocol || ''} onChange={(e) => updateSpec(row._key, { protocol: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">IP Rating</Label>
                              <Input className="h-9" value={row.specifications?.ip_rating || ''} onChange={(e) => updateSpec(row._key, { ip_rating: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Mounting</Label>
                              <Input className="h-9" value={row.specifications?.mounting_type || ''} onChange={(e) => updateSpec(row._key, { mounting_type: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Compliance</Label>
                              <Input className="h-9" value={row.specifications?.compliance_standards || ''} onChange={(e) => updateSpec(row._key, { compliance_standards: e.target.value })} />
                            </div>
                            <div className="col-span-3">
                              <Label className="text-xs">Remarks</Label>
                              <Input className="h-9" value={row.specifications?.remarks || ''} onChange={(e) => updateSpec(row._key, { remarks: e.target.value })} />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Lead-level fields */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label>Timeline</Label>
                  <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 2 weeks" />
                </div>
                {isTechnical && (
                  <div>
                    <Label>Site context</Label>
                    <Input value={siteContext} onChange={(e) => setSiteContext(e.target.value)} placeholder="Indoor / panel mounted / dusty..." />
                  </div>
                )}
              </div>

              <div>
                <Label>Decision reason / handoff notes</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Context for SPT / TST" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={validateAndSubmit} disabled={qualify.isPending}>
            {qualify.isPending ? 'Saving...' : existing ? 'Update' : isInvalid ? 'Mark Invalid' : isTechnical ? 'Send to TST' : 'Send to SPT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
