import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useImportListPrices, useExtractListPricePdf, type ListPriceRow } from '@/hooks/useProducts';
import { toast } from 'sonner';

interface ListPriceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumnIndex(headers: string[], keywords: string[]): number {
  const norms = headers.map(normalizeHeader);
  for (const kw of keywords) {
    const idx = norms.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapRows(headers: string[], rawRows: any[]): ListPriceRow[] {
  const modelIdx = findColumnIndex(headers, ['model', 'mlfb', 'article', 'articleno', 'catalog', 'partno', 'material', 'modelno']);
  const descIdx = findColumnIndex(headers, ['description', 'desc', 'productname', 'product', 'materialdescription']);
  const hsnIdx = findColumnIndex(headers, ['hsn', 'sac', 'hsncode']);
  const priceIdx = findColumnIndex(headers, ['list', 'listprice', 'price', 'mrp', 'rate', 'amount', 'lp', 'netprice']);

  if (modelIdx === -1 || priceIdx === -1) {
    throw new Error('Could not find required columns (model number and price).');
  }

  return rawRows
    .map((row) => {
      const cells = Array.isArray(row) ? row : headers.map((h) => row[h]);
      const model = String(cells[modelIdx] ?? '').trim();
      const price = parsePrice(cells[priceIdx]);
      if (!model || price === null) return null;
      return {
        model_number: model,
        description: descIdx !== -1 ? String(cells[descIdx] ?? '').trim() || null : null,
        hsn_code: hsnIdx !== -1 ? String(cells[hsnIdx] ?? '').trim() || null : null,
        list_price: price,
      };
    })
    .filter((r): r is ListPriceRow => r !== null);
}

export function ListPriceUploadDialog({ open, onOpenChange }: ListPriceUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Siemens Price List');
  const [brand, setBrand] = useState('Siemens');
  const [defaultDiscountPct, setDefaultDiscountPct] = useState(40);
  const [rows, setRows] = useState<ListPriceRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportListPrices();
  const extractPdfMutation = useExtractListPricePdf();

  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
    setError(null);
    setIsParsing(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const parseStructuredFile = async (f: File): Promise<ListPriceRow[]> => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      const text = await f.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.rows ?? [];
      return arr
        .map((r: any) => ({
          model_number: String(r.model_number ?? r.model ?? r.article ?? '').trim(),
          description: r.description ? String(r.description).trim() : null,
          hsn_code: r.hsn_code ? String(r.hsn_code).trim() : null,
          list_price: parsePrice(r.list_price ?? r.price ?? r.lp),
        }))
        .filter((r) => r.model_number && r.list_price !== null);
    }

    if (ext === 'csv' || ext === 'txt') {
      return new Promise((resolve, reject) => {
        Papa.parse(f, {
          complete: (results) => {
            try {
              const data = results.data as any[];
              if (!data.length) return resolve([]);
              const first = data[0];
              const hasHeaders = typeof first === 'object' && !Array.isArray(first);
              if (hasHeaders) {
                const headers = Object.keys(first);
                resolve(mapRows(headers, data));
              } else {
                // No headers: assume columns [model, description, hsn, price]
                const mapped = data
                  .filter((r) => Array.isArray(r) && r.length >= 2)
                  .map((r) => ({
                    model_number: String(r[0]).trim(),
                    description: r[1] ? String(r[1]).trim() : null,
                    hsn_code: r[2] ? String(r[2]).trim() : null,
                    list_price: parsePrice(r[r.length - 1]),
                  }))
                  .filter((r) => r.model_number && r.list_price !== null);
                resolve(mapped);
              }
            } catch (e) {
              reject(e);
            }
          },
          error: (err) => reject(err),
          skipEmptyLines: true,
        });
      });
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (!json.length) return [];
      const headers = json[0].map((h) => String(h ?? ''));
      return mapRows(headers, json.slice(1));
    }

    throw new Error('Unsupported file type.');
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setRows([]);
    setIsParsing(true);

    try {
      const ext = f.name.split('.').pop()?.toLowerCase();
      let parsed: ListPriceRow[] = [];
      if (ext === 'pdf') {
        const res = await extractPdfMutation.mutateAsync({ file: f, brand });
        parsed = res.rows ?? [];
      } else {
        parsed = await parseStructuredFile(f);
      }
      setRows(parsed);
      toast.success(`Parsed ${parsed.length} rows`);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    try {
      const result = await importMutation.mutateAsync({
        rows,
        sourceLabel,
        brand,
        defaultDiscountPct,
      });
      toast.success(`Imported ${result.upserted} of ${result.rows_parsed} products`);
      handleClose(false);
    } catch {
      // error toast handled by mutation
    }
  };

  const floorRate = (lp: number) => {
    return Math.round(lp * (1 - defaultDiscountPct / 100));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import List Prices</DialogTitle>
          <DialogDescription>
            Upload a Siemens/brand price list (CSV, Excel, JSON, or PDF). Matching products will be updated; new ones will be added.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="lp-source">Source Label</Label>
              <Input
                id="lp-source"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="e.g. Siemens Price List"
              />
            </div>
            <div>
              <Label htmlFor="lp-brand">Brand</Label>
              <Input
                id="lp-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Siemens"
              />
            </div>
            <div>
              <Label htmlFor="lp-discount">Min Margin / Discount %</Label>
              <Input
                id="lp-discount"
                type="number"
                min={0}
                max={100}
                value={defaultDiscountPct}
                onChange={(e) => setDefaultDiscountPct(Number(e.target.value))}
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {file ? file.name : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports CSV, Excel, JSON, and PDF price lists
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isParsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing file…
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Preview ({rows.length} rows)</h4>
                <Badge variant="secondary" className="text-xs">
                  Floor = LP × {100 - defaultDiscountPct}%
                </Badge>
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Model Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">HSN</TableHead>
                      <TableHead className="text-right w-[100px]">List Price</TableHead>
                      <TableHead className="text-right w-[100px]">Floor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs">{row.model_number}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{row.description ?? '-'}</TableCell>
                        <TableCell className="text-xs">{row.hsn_code ?? '-'}</TableCell>
                        <TableCell className="text-right text-xs">
                          {row.list_price.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {floorRate(row.list_price).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {rows.length > 100 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 100 of {rows.length} rows.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!rows.length || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Import {rows.length > 0 ? `${rows.length} products` : 'products'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
