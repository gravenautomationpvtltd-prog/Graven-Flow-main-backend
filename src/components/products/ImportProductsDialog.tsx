import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  ACTIVE_TEMPLATE_CSV,
  LEGACY_TEMPLATE_CSV,
  buildErrorCsv,
  countDuplicates,
  downloadCsv,
  validateCsv,
  type ActiveImportRow,
  type ImportType,
  type ValidationResult,
} from '@/lib/product-csv';
import { formatINR } from '@/lib/pricing';
import { useImportRun, useStartProductImport } from '@/hooks/useProductImport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
}

export function ImportProductsDialog({ open, onOpenChange, type }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const startImport = useStartProductImport();
  const { data: run } = useImportRun(runId);

  const isActive = type === 'active';
  const title = isActive ? 'Import Active Products & Prices' : 'Import Discontinued / Obsolete Products';
  const columns = isActive
    ? 'Sr No, Brand, Model No, Description, List Price, Sales Discount %, Purchase Discount %'
    : 'Sr No, Brand, Model No, Description, Status, Sales Price, Purchase Price';

  const duplicates = useMemo(() => (result ? countDuplicates(result.rows) : 0), [result]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      setResult(validateCsv(text, type));
    } finally {
      setParsing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFilename('');
    setRunId(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const confirmImport = async () => {
    if (!result?.validRows.length) return;
    const id = await startImport.mutateAsync({ rows: result.validRows, type, filename });
    setRunId(id);
  };

  const progress = run && run.rows_parsed > 0 ? Math.round((run.rows_processed / run.rows_parsed) * 100) : 0;
  const preview: ActiveImportRow[] = result?.rows.slice(0, 100) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>Required columns: {columns}</DialogDescription>
        </DialogHeader>

        {/* Step 3 — running */}
        {runId ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center gap-2 text-sm">
              {run?.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>
                {run?.status === 'completed'
                  ? 'Import completed'
                  : run?.status === 'failed'
                    ? 'Import failed'
                    : 'Processing...'}
              </span>
            </div>
            <Progress value={run?.status === 'completed' ? 100 : progress} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <Stat label="New" value={run?.rows_new ?? 0} />
              <Stat label="Updated" value={run?.rows_updated ?? 0} />
              <Stat label="Unchanged" value={run?.rows_unchanged ?? 0} />
              <Stat label="Errors" value={(run?.rows_errored ?? 0) + (result?.errorRows.length ?? 0)} />
              <Stat label="Total processed" value={run?.rows_processed ?? 0} />
            </div>
            {run?.error_message && <p className="text-sm text-destructive">{run.error_message}</p>}
            <div className="flex justify-end gap-2">
              {!!result?.errorRows.length && (
                <Button
                  variant="outline"
                  onClick={() => downloadCsv(`import-errors-${Date.now()}.csv`, buildErrorCsv(result.errorRows))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download error CSV
                </Button>
              )}
              <Button onClick={close} disabled={run?.status === 'processing'}>
                {run?.status === 'processing' ? 'Please wait...' : 'Done'}
              </Button>
            </div>
          </div>
        ) : !result ? (
          /* Step 1 — choose file */
          <div className="space-y-4 py-4">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg py-12 flex flex-col items-center gap-2 hover:border-primary transition-colors"
            >
              {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />}
              <span className="text-sm font-medium">{parsing ? 'Validating...' : 'Choose a CSV file'}</span>
              <span className="text-xs text-muted-foreground">Supports 50,000+ rows</span>
            </button>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    isActive ? 'active-products-template.csv' : 'discontinued-products-template.csv',
                    isActive ? ACTIVE_TEMPLATE_CSV : LEGACY_TEMPLATE_CSV,
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Download template
              </Button>
              <Button variant="outline" onClick={close}>Cancel</Button>
            </div>
          </div>
        ) : (
          /* Step 2 — review */
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {result.validRows.length} rows ready
              </Badge>
              {duplicates > 0 && <Badge variant="secondary">{duplicates} duplicate rows in file</Badge>}
              {result.errorRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {result.errorRows.length} rows with errors (skipped)
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{filename}</span>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Row</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model No</TableHead>
                    <TableHead>Description</TableHead>
                    {isActive ? (
                      <>
                        <TableHead className="text-right">List</TableHead>
                        <TableHead className="text-right">Sales %</TableHead>
                        <TableHead className="text-right">Purch %</TableHead>
                      </>
                    ) : (
                      <TableHead>Status</TableHead>
                    )}
                    <TableHead className="text-right">Sales price</TableHead>
                    <TableHead className="text-right">Purchase</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={r.line_no} className={r.error && !r.error.startsWith('Duplicate') ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{r.line_no}</TableCell>
                      <TableCell className="text-sm">{r.brand}</TableCell>
                      <TableCell className="text-sm font-mono">{r.model_no}</TableCell>
                      <TableCell className="text-sm max-w-[240px] truncate">
                        {r.description}
                        {r.error && <div className="text-[11px] text-destructive">{r.error}</div>}
                      </TableCell>
                      {isActive ? (
                        <>
                          <TableCell className="text-right text-sm">{formatINR(r.list_price)}</TableCell>
                          <TableCell className="text-right text-sm">{r.sales_discount_pct ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{r.purchase_discount_pct ?? '—'}</TableCell>
                        </>
                      ) : (
                        <TableCell className="text-sm capitalize">{r.product_status}</TableCell>
                      )}
                      <TableCell className="text-right text-sm">{formatINR(r.sales_price)}</TableCell>
                      <TableCell className="text-right text-sm">{formatINR(r.purchase_price)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.gross_margin_pct === null ? '—' : `${r.gross_margin_pct}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {result.rows.length > preview.length && (
                <p className="text-xs text-muted-foreground p-3">
                  Showing first {preview.length} of {result.rows.length} rows.
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-between items-center gap-2">
              <Button variant="ghost" onClick={reset}>← Choose another file</Button>
              <div className="flex gap-2">
                {result.errorRows.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => downloadCsv(`import-errors-${Date.now()}.csv`, buildErrorCsv(result.errorRows))}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Error CSV
                  </Button>
                )}
                <Button onClick={confirmImport} disabled={!result.validRows.length || startImport.isPending}>
                  {startImport.isPending ? 'Starting...' : `Import ${result.validRows.length} products`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value.toLocaleString('en-IN')}</div>
    </div>
  );
}
