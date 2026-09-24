import { Fragment, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileSpreadsheet, FileDown, ArrowUpDown, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { QuotationWithDetails } from '@/hooks/useQuotations';
import { useQuotationComparison } from '@/hooks/useQuotationComparison';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import {
  buildComparisonRows,
  comparisonRowsToCSV,
  DEFAULT_ASSUMPTIONS,
  type ComparisonAssumptions,
  type ComparisonRow,
  type LineOverride,
} from '@/lib/comparison-sheet';
import { downloadComparisonSheetPDF } from '@/lib/comparison-pdf';
import { downloadCSV } from '@/lib/csv-utils';
import { format } from 'date-fns';

const num = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

type SortKey = 'model' | 'margin' | 'quoted' | 'total';

const FIELDS: { key: keyof ComparisonAssumptions; label: string }[] = [
  { key: 'rmb_usd_rate', label: 'RMB→USD' },
  { key: 'usd_inr_rate', label: 'USD→INR' },
  { key: 'freight_usd_per_kg', label: 'Freight $/kg' },
  { key: 'insurance_pct', label: 'Insurance %' },
  { key: 'cc_pct', label: 'CC %' },
  { key: 'duty_pct', label: 'Duty %' },
  { key: 'expense_pct', label: 'Expense %' },
  { key: 'margin_pct', label: 'Margin %' },
  { key: 'negotiation_pct', label: 'Negotiation %' },
];

export function PriceComparisonSheetDialog({
  open,
  onOpenChange,
  quotation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithDetails | null;
}) {
  const { branding } = useTenantBranding();
  const [whatIf, setWhatIf] = useState(false);
  const [assumptions, setAssumptions] = useState<ComparisonAssumptions>(DEFAULT_ASSUMPTIONS);
  const [sortKey, setSortKey] = useState<SortKey>('model');
  const [asc, setAsc] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [lineOverrides, setLineOverrides] = useState<Record<number, LineOverride>>({});

  const { data: inputs, isLoading } = useQuotationComparison(
    quotation?.id,
    quotation?.items,
    open && !!quotation,
  );

  const { rows, totals } = useMemo(
    () => buildComparisonRows(inputs || [], whatIf ? assumptions : null, lineOverrides),
    [inputs, whatIf, assumptions, lineOverrides],
  );

  const setLineField = (idx: number, key: keyof LineOverride, raw: string) => {
    setLineOverrides((prev) => {
      const next = { ...prev, [idx]: { ...(prev[idx] || {}) } };
      if (raw === '') delete (next[idx] as Record<string, unknown>)[key];
      else (next[idx] as Record<string, unknown>)[key] = Number(raw);
      if (!Object.keys(next[idx]).length) delete next[idx];
      return next;
    });
  };

  const resetLine = (idx: number) =>
    setLineOverrides((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });


  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const val = (r: ComparisonRow) =>
        sortKey === 'model'
          ? r.model_number || r.description
          : sortKey === 'margin'
            ? (r.margin_pct ?? -Infinity)
            : sortKey === 'quoted'
              ? r.quoted_rate
              : r.line_total;
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [rows, sortKey, asc]);

  if (!quotation) return null;

  const meta = {
    quotationNumber: quotation.quotation_number,
    customerName: quotation.customer?.company_name || null,
    date: format(new Date(quotation.created_at), 'dd MMM yyyy'),
    assumptions: whatIf ? assumptions : null,
  };

  const handlePDF = () => {
    try {
      downloadComparisonSheetPDF(sorted, totals, meta, branding);
      toast.success('Comparison sheet PDF downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate comparison sheet PDF');
    }
  };

  const handleCSV = () => {
    const csv = comparisonRowsToCSV(sorted, totals, {
      quotationNumber: quotation.quotation_number,
      customer: quotation.customer?.company_name,
      assumptions: whatIf ? assumptions : null,
    });
    downloadCSV(csv, `PriceComparison_${quotation.quotation_number}.csv`);
    toast.success('Comparison sheet CSV downloaded');
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  const marginClass = (r: ComparisonRow) =>
    r.margin_pct == null
      ? 'text-muted-foreground'
      : r.below_min_margin
        ? 'text-destructive font-semibold'
        : r.margin_pct < 10
          ? 'text-amber-600 font-medium'
          : 'text-emerald-600 font-medium';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] max-h-[92vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle>Price Comparison — {quotation.quotation_number}</DialogTitle>
            <Badge variant="destructive" className="text-[10px]">INTERNAL — NOT FOR CUSTOMER</Badge>
          </div>
          <DialogDescription>
            Full landed cost build-up (FOB, freight, insurance, duty, expenses) against list price, quoted net rate, tax and margin — matching invoice logic.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border rounded-md p-3">
          <Button
            size="sm"
            variant={whatIf ? 'default' : 'outline'}
            onClick={() => setWhatIf((v) => !v)}
          >
            {whatIf ? 'What-if on' : 'What-if off'}
          </Button>
          {whatIf && (
            <>
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-1">
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{f.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 w-20 text-xs"
                    value={assumptions[f.key]}
                    onChange={(e) =>
                      setAssumptions((a) => ({ ...a, [f.key]: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setAssumptions(DEFAULT_ASSUMPTIONS)}>
                Reset
              </Button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCSV} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" onClick={handlePDF} disabled={!rows.length}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pricing data…
            </div>
          ) : !rows.length ? (
            <p className="text-center text-muted-foreground py-16 text-sm">No line items to compare.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-2 w-6"></th>
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2 cursor-pointer" onClick={() => toggleSort('model')}>
                    <span className="inline-flex items-center gap-1">Model <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-2 py-2">Description</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">List ₹</th>
                  <th className="px-2 py-2 text-right">RMB</th>
                  <th className="px-2 py-2 text-right">FOB ₹</th>
                  <th className="px-2 py-2 text-right">Frt+Ins ₹</th>
                  <th className="px-2 py-2 text-right">Duty+CC ₹</th>
                  <th className="px-2 py-2 text-right">Exp ₹</th>
                  <th className="px-2 py-2 text-right">Landed ₹</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort('quoted')}>
                    Net rate ₹
                  </th>
                  <th className="px-2 py-2 text-right">Margin ₹</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort('margin')}>
                    Margin %
                  </th>
                  <th className="px-2 py-2 text-right">Tax %</th>
                  <th className="px-2 py-2 text-right">Tax ₹</th>
                  <th className="px-2 py-2 text-right cursor-pointer" onClick={() => toggleSort('total')}>
                    Total incl. tax ₹
                  </th>
                  <th className="px-2 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <Fragment key={`${r.model_number}-${r.index}`}>
                  <tr
                    className={`border-t align-top ${r.has_line_override ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        aria-label={expanded === r.index ? 'Collapse breakdown' : 'Expand breakdown'}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setExpanded((v) => (v === r.index ? null : r.index))}
                      >
                        {expanded === r.index ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2 font-medium">{r.model_number || '—'}</td>
                    <td className="px-2 py-2 max-w-[260px] break-words text-muted-foreground">
                      {r.description || '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.quantity} {r.unit}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.list_price)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.rmb_price)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.breakdown?.fob_inr ?? null)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {num(r.breakdown ? r.breakdown.freight_inr + r.breakdown.insurance_inr : null)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {num(r.breakdown ? r.breakdown.duty_inr + r.breakdown.cc_inr : null)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.breakdown?.expense_inr ?? null)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.landed_inr_per_unit)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{num(r.net_rate)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${marginClass(r)}`}>{num(r.margin_inr)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${marginClass(r)}`}>
                      {r.margin_pct == null ? '—' : `${num(r.margin_pct, 1)}%`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.tax_percent, 1)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.tax_amount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(r.line_total_with_tax)}</td>
                    <td className="px-2 py-2">
                      <Badge variant={r.source === 'Bulk price approval' ? 'default' : 'outline'} className="text-[10px]">
                        {r.source}
                      </Badge>
                    </td>
                  </tr>
                  {expanded === r.index && (
                    <tr className="border-t bg-muted/30">
                      <td colSpan={19} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-full">
                            Landed-cost components — {r.model_number || r.description || 'line'} (per unit)
                          </div>
                          {([
                            { key: 'rmb_price' as const, label: 'RMB price', ph: r.rmb_price },
                            { key: 'weight_kg' as const, label: 'Weight kg', ph: r.weight_kg },
                            ...FIELDS.map((f) => ({ key: f.key as keyof LineOverride, label: f.label, ph: r.assumptions[f.key] })),
                          ]).map((f) => (
                            <div key={String(f.key)} className="flex flex-col gap-0.5">
                              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">{f.label}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 w-24 text-xs"
                                placeholder={f.ph == null ? '—' : String(f.ph)}
                                value={
                                  (lineOverrides[r.index]?.[f.key] as number | undefined) ?? ''
                                }
                                onChange={(e) => setLineField(r.index, f.key, e.target.value)}
                              />
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" onClick={() => resetLine(r.index)} disabled={!lineOverrides[r.index]}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset line
                          </Button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                          {[
                            ['FOB ₹', r.breakdown?.fob_inr],
                            ['Freight ₹', r.breakdown?.freight_inr],
                            ['Insurance ₹', r.breakdown?.insurance_inr],
                            ['CC ₹', r.breakdown?.cc_inr],
                            ['Duty ₹', r.breakdown?.duty_inr],
                            ['Expenses ₹', r.breakdown?.expense_inr],
                            ['Landed cost ₹', r.breakdown?.landed_cost_inr],
                          ].map(([label, v]) => (
                            <div key={String(label)} className="rounded-md border bg-background px-2 py-1.5">
                              <div className="text-muted-foreground">{label as string}</div>
                              <div className="tabular-nums font-medium">{num((v as number | undefined) ?? null)}</div>
                            </div>
                          ))}
                          <div className="rounded-md border bg-background px-2 py-1.5">
                            <div className="text-muted-foreground">Reference sell ₹</div>
                            <div className="tabular-nums font-medium">{num(r.suggested_price_inr)}</div>
                          </div>
                          <div className="rounded-md border bg-background px-2 py-1.5">
                            <div className="text-muted-foreground">Quoted net rate ₹</div>
                            <div className="tabular-nums font-medium">{num(r.net_rate)}</div>
                          </div>
                          <div className="rounded-md border bg-background px-2 py-1.5">
                            <div className="text-muted-foreground">Margin ₹ / %</div>
                            <div className={`tabular-nums ${marginClass(r)}`}>
                              {num(r.margin_inr)} / {r.margin_pct == null ? '—' : `${num(r.margin_pct, 1)}%`}
                            </div>
                          </div>
                          <div className="rounded-md border bg-background px-2 py-1.5">
                            <div className="text-muted-foreground">Line total incl. tax ₹</div>
                            <div className="tabular-nums font-medium">{num(r.line_total_with_tax)}</div>
                          </div>
                        </div>
                        {r.rmb_price == null && (
                          <p className="mt-2 text-[11px] text-amber-600">
                            No RMB reference for this line — enter an RMB price above to compute a landed cost.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="flex flex-wrap gap-4 text-xs border rounded-md p-3 bg-muted/30">
          <span>Total list: <strong>₹{num(totals.listValue)}</strong></span>
          <span>Freight + ins: <strong>₹{num(totals.freightValue)}</strong></span>
          <span>Duty + CC: <strong>₹{num(totals.dutyValue)}</strong></span>
          <span>Expenses: <strong>₹{num(totals.expenseValue)}</strong></span>
          <span>Total landed: <strong>₹{num(totals.landedValue)}</strong></span>
          <span>Taxable: <strong>₹{num(totals.quotedValue)}</strong></span>
          <span>Tax: <strong>₹{num(totals.taxValue)}</strong></span>
          <span>Grand total: <strong>₹{num(totals.quotedValueWithTax)}</strong></span>
          <span>Total margin: <strong>₹{num(totals.marginValue)}</strong></span>
          <span>
            Blended margin:{' '}
            <strong>{totals.blendedMarginPct == null ? '—' : `${num(totals.blendedMarginPct, 1)}%`}</strong>
          </span>
          {totals.missingRmbCount > 0 && (
            <span className="text-amber-600">
              {totals.missingRmbCount} line(s) without RMB reference
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
