import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, ArrowLeft, Calculator } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { computeLandedCost, DEFAULTS, type CalcInputs, type CalcResult } from '@/lib/landed-cost';
import { useIsBulkPriceApprover } from '@/hooks/useProcurementApprovers';

type Item = any;

function toCalcInputs(row: Item): CalcInputs {
  return {
    rmb_price: Number(row.rmb_price ?? row.cny_unit_price ?? 0),
    rmb_usd_rate: Number(row.rmb_usd_rate ?? DEFAULTS.rmb_usd_rate),
    usd_inr_rate: Number(row.usd_inr_rate ?? DEFAULTS.usd_inr_rate),
    weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
    freight_usd_per_kg: Number(row.freight_usd_per_kg ?? DEFAULTS.freight_usd_per_kg),
    insurance_pct: Number(row.insurance_pct ?? DEFAULTS.insurance_pct),
    cc_pct: Number(row.cc_pct ?? DEFAULTS.cc_pct),
    duty_pct: Number(row.duty_pct ?? DEFAULTS.duty_pct),
    expense_pct: Number(row.expense_pct ?? DEFAULTS.expense_pct),
    margin_pct: Number(row.margin_pct ?? DEFAULTS.margin_pct),
    negotiation_pct: Number(row.negotiation_pct ?? DEFAULTS.negotiation_pct),
    qty: Number(row.qty ?? 1),
  };
}

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const usd = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function PriceApprovalDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const isApprover = useIsBulkPriceApprover();
  const [rows, setRows] = useState<Item[]>([]);

  const { data: batch } = useQuery({
    queryKey: ['price-batch', id],
    enabled: !!id && isApprover,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_submission_batches')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      let submitter: any = null;
      if ((data as any)?.submitted_by) {
        const { data: p } = await supabase.from('profiles').select('full_name, email')
          .eq('id', (data as any).submitted_by).maybeSingle();
        submitter = p;
      }
      return { ...(data as any), submitter };
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ['price-items', id],
    enabled: !!id && isApprover,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_submission_items')
        .select('*')
        .eq('batch_id', id!)
        .order('line_no');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => { if (items) setRows(items as any); }, [items]);

  const setRow = (idx: number, patch: Partial<Item>) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const applyDefaultsAll = (patch: Partial<Item>) => {
    setRows(rs => rs.map(r => ({ ...r, ...patch })));
  };

  const results = useMemo(() => rows.map(toCalcInputs).map(computeLandedCost), [rows]);

  const saveRow = useMutation({
    mutationFn: async (idx: number) => {
      const r = rows[idx];
      const c = results[idx];
      const { error } = await supabase.from('price_submission_items').update({
        rmb_price: r.rmb_price ?? r.cny_unit_price,
        rmb_usd_rate: r.rmb_usd_rate,
        usd_inr_rate: r.usd_inr_rate,
        weight_kg: r.weight_kg,
        freight_usd_per_kg: r.freight_usd_per_kg,
        insurance_pct: r.insurance_pct,
        cc_pct: r.cc_pct,
        duty_pct: r.duty_pct,
        expense_pct: r.expense_pct,
        margin_pct: r.margin_pct,
        negotiation_pct: r.negotiation_pct,
        qty: r.qty,
        computed_usd_landed: c.v7,
        computed_inr_per_unit: c.final_inr_per_unit,
        computed_inr_total: c.final_inr_total,
      } as any).eq('id', r.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Saved'),
    onError: (e: any) => toast.error(e.message),
  });

  const approveRow = useMutation({
    mutationFn: async (idx: number) => {
      await saveRow.mutateAsync(idx);
      const { data, error } = await supabase.rpc('approve_price_item', { _item_id: rows[idx].id } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Approved — product updated');
      qc.invalidateQueries({ queryKey: ['price-items', id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveAll = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].approved) continue;
        await saveRow.mutateAsync(i);
        const { error } = await supabase.rpc('approve_price_item', { _item_id: rows[i].id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('All rows approved');
      qc.invalidateQueries({ queryKey: ['price-items', id] });
      qc.invalidateQueries({ queryKey: ['price-batch', id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markBatchStatus = useMutation({
    mutationFn: async (status: 'approved' | 'rejected') => {
      const { error } = await supabase.from('price_submission_batches').update({
        status, reviewed_at: new Date().toISOString(),
      } as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: (_v, status) => {
      toast.success(`Batch ${status}`);
      qc.invalidateQueries({ queryKey: ['price-batch', id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isApprover) return <Navigate to="/" replace />;
  if (isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/procurement/price-approvals"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {batch?.supplier_name || 'Batch'} <Badge variant="secondary">{batch?.status}</Badge>
          </h1>
          <p className="text-muted-foreground">
            From {batch?.submitter?.full_name || batch?.submitter?.email} · {rows.length} items
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markBatchStatus.mutate('rejected')}>Reject batch</Button>
          <Button onClick={() => approveAll.mutate()} disabled={approveAll.isPending}>
            {approveAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve all
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch defaults</CardTitle>
          <CardDescription>Apply to every row. Per-row edits always win.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <DefaultField label="RMB→USD" defVal={DEFAULTS.rmb_usd_rate} onApply={v => applyDefaultsAll({ rmb_usd_rate: v })} />
          <DefaultField label="USD→INR" defVal={DEFAULTS.usd_inr_rate} onApply={v => applyDefaultsAll({ usd_inr_rate: v })} />
          <DefaultField label="Freight $/kg" defVal={DEFAULTS.freight_usd_per_kg} onApply={v => applyDefaultsAll({ freight_usd_per_kg: v })} />
          <DefaultField label="Insurance %" defVal={DEFAULTS.insurance_pct} onApply={v => applyDefaultsAll({ insurance_pct: v })} />
          <DefaultField label="CC %" defVal={DEFAULTS.cc_pct} onApply={v => applyDefaultsAll({ cc_pct: v })} />
          <DefaultField label="Duty %" defVal={DEFAULTS.duty_pct} onApply={v => applyDefaultsAll({ duty_pct: v })} />
          <DefaultField label="Expense %" defVal={DEFAULTS.expense_pct} onApply={v => applyDefaultsAll({ expense_pct: v })} />
          <DefaultField label="Margin %" defVal={DEFAULTS.margin_pct} onApply={v => applyDefaultsAll({ margin_pct: v })} />
          <DefaultField label="Negotiation %" defVal={DEFAULTS.negotiation_pct} onApply={v => applyDefaultsAll({ negotiation_pct: v })} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rows.map((r, idx) => (
          <RowCard
            key={r.id}
            row={r}
            calc={results[idx]}
            onChange={patch => setRow(idx, patch)}
            onSave={() => saveRow.mutate(idx)}
            onApprove={() => approveRow.mutate(idx)}
            saving={saveRow.isPending}
            approving={approveRow.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function DefaultField({ label, defVal, onApply }: { label: string; defVal: number; onApply: (v: number) => void }) {
  const [v, setV] = useState(String(defVal));
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input type="number" step="0.01" value={v} onChange={e => setV(e.target.value)} className="h-8" />
        <Button size="sm" variant="secondary" className="h-8" onClick={() => onApply(parseFloat(v) || 0)}>Apply</Button>
      </div>
    </div>
  );
}

function RowCard({ row, calc, onChange, onSave, onApprove, saving, approving }: {
  row: Item; calc: CalcResult;
  onChange: (patch: Partial<Item>) => void;
  onSave: () => void;
  onApprove: () => void;
  saving: boolean; approving: boolean;
}) {
  const N = (k: string) => Number(row[k] ?? 0);
  const inputCls = 'h-8';

  return (
    <Card className={row.approved ? 'border-emerald-500/50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Badge variant="outline">#{row.line_no}</Badge>
            <CardTitle className="text-lg">{row.model_number || row.item_name}</CardTitle>
            {row.approved && <Badge className="bg-emerald-600">Approved</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Final INR / unit</div>
              <div className="text-lg font-semibold">{inr(calc.final_inr_per_unit)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={onSave} disabled={saving || row.approved}>Save</Button>
            <Button size="sm" onClick={onApprove} disabled={approving || row.approved}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" />Approve</>}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Model" value={row.model_number || ''} onChange={v => onChange({ model_number: v })} />
          <NumField label="Qty" value={N('qty')} onChange={v => onChange({ qty: v })} />
          <NumField label="RMB price" value={N('rmb_price') || N('cny_unit_price')} onChange={v => onChange({ rmb_price: v })} />
          <NumField label="Weight (kg)" value={row.weight_kg ?? 0} onChange={v => onChange({ weight_kg: v })} />
          <NumField label="RMB→USD" value={N('rmb_usd_rate')} onChange={v => onChange({ rmb_usd_rate: v })} />
          <NumField label="USD→INR" value={N('usd_inr_rate')} onChange={v => onChange({ usd_inr_rate: v })} />
          <NumField label="Freight $/kg" value={N('freight_usd_per_kg')} onChange={v => onChange({ freight_usd_per_kg: v })} />
          <NumField label="Insurance %" value={N('insurance_pct')} onChange={v => onChange({ insurance_pct: v })} />
          <NumField label="CC %" value={N('cc_pct')} onChange={v => onChange({ cc_pct: v })} />
          <NumField label="Duty %" value={N('duty_pct')} onChange={v => onChange({ duty_pct: v })} />
          <NumField label="Expense %" value={N('expense_pct')} onChange={v => onChange({ expense_pct: v })} />
          <NumField label="Margin %" value={N('margin_pct')} onChange={v => onChange({ margin_pct: v })} />
          <NumField label="Negotiation %" value={N('negotiation_pct')} onChange={v => onChange({ negotiation_pct: v })} />
        </div>

        <Separator />

        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" /> Calculation chain
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4 font-mono text-xs">
            <span>USD base = {N('rmb_price') || N('cny_unit_price')} ÷ {N('rmb_usd_rate')}</span><span className="text-right">{usd(calc.usd_base)}</span>
            <span>+ Freight = ⌈{row.weight_kg ?? 0}⌉ × ${N('freight_usd_per_kg')}</span><span className="text-right">{usd(calc.freight_usd)}</span>
            <span className="font-semibold">v1 = base + freight</span><span className="text-right font-semibold">{usd(calc.v1)}</span>
            <span>v2 × (1 + I {N('insurance_pct')}%)</span><span className="text-right">{usd(calc.v2)}</span>
            <span>v3 × (1 + CC {N('cc_pct')}%)</span><span className="text-right">{usd(calc.v3)}</span>
            <span>v4 × (1 + D {N('duty_pct')}%)</span><span className="text-right">{usd(calc.v4)}</span>
            <span>v5 × (1 + EXP {N('expense_pct')}%)</span><span className="text-right">{usd(calc.v5)}</span>
            <span>v6 × (1 + Margin {N('margin_pct')}%)</span><span className="text-right">{usd(calc.v6)}</span>
            <span>v7 × (1 + N {N('negotiation_pct')}%)</span><span className="text-right">{usd(calc.v7)}</span>
            <span className="font-semibold">× USD→INR {N('usd_inr_rate')} =</span><span className="text-right font-semibold">{inr(calc.final_inr_per_unit)} / unit</span>
            <span className="font-semibold">Line total × {N('qty')} =</span><span className="text-right font-semibold">{inr(calc.final_inr_total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-8" />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} className="h-8" />
    </div>
  );
}
