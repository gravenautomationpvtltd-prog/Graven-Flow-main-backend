import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useGstFiling, useCompanyGstin } from '@/hooks/useGstFiling';
import {
  buildGstr1Json,
  buildGstr3bJson,
  downloadJson,
  monthPeriod,
  posLabel,
  validateOutward,
} from '@/lib/gst-returns';
import { toCSV, formatINR, round2 } from '@/lib/financial-statements';
import { downloadCSV } from '@/lib/csv-utils';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function GstFilingTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const period = useMemo(() => monthPeriod(year, month), [year, month]);

  const { data, isLoading } = useGstFiling(period);
  const { data: gstin } = useCompanyGstin();

  const outward = data?.outward ?? [];
  const inward = data?.inward ?? [];
  const issues = useMemo(() => validateOutward(outward), [outward]);

  const outputTax = round2(outward.reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0));
  const inputTax = round2(inward.filter((r) => r.itcEligible).reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0));
  const netTax = round2(outputTax - inputTax);

  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - i);

  const exportOutwardCsv = () => {
    const rows: (string | number)[][] = [
      ['Invoice No', 'Date', 'Customer', 'Customer GSTIN', 'Place of supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
      ...outward.map((r) => [
        r.invoiceNumber, r.invoiceDate, r.customerName, r.customerGstin ?? '',
        posLabel(r.stateCode), r.taxable, r.cgst, r.sgst, r.igst, r.total,
      ]),
    ];
    downloadCSV(toCSV(rows), `outward-register-${period.fp}.csv`);
  };

  const exportInwardCsv = () => {
    const rows: (string | number)[][] = [
      ['Bill No', 'Date', 'Supplier', 'Supplier GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'ITC eligible'],
      ...inward.map((r) => [
        r.billNumber, r.billDate, r.supplierName, r.supplierGstin ?? '',
        r.taxable, r.cgst, r.sgst, r.igst, r.total, r.itcEligible ? 'Yes' : 'No',
      ]),
    ];
    downloadCSV(toCSV(rows), `inward-register-${period.fp}.csv`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>GST filing — {period.label}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {gstin ? `GSTIN ${gstin}` : 'Add your GSTIN in Settings to enable the return files'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Output tax (sales)</p>
            <p className="text-2xl font-bold">{formatINR(outputTax)}</p>
            <p className="text-xs text-muted-foreground">{outward.length} invoices</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Input tax credit (purchases)</p>
            <p className="text-2xl font-bold">{formatINR(inputTax)}</p>
            <p className="text-xs text-muted-foreground">{inward.length} purchase bills</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{netTax >= 0 ? 'Net payable' : 'Credit carried forward'}</p>
            <p className={`text-2xl font-bold ${netTax >= 0 ? 'text-destructive' : 'text-primary'}`}>{formatINR(netTax)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => downloadJson(buildGstr1Json(gstin ?? '', period, outward), `GSTR1-${period.fp}.json`)} disabled={!outward.length}>
          <FileJson className="mr-2 h-4 w-4" /> GSTR-1 JSON
        </Button>
        <Button onClick={() => downloadJson(buildGstr3bJson(gstin ?? '', period, outward, inward), `GSTR3B-${period.fp}.json`)} disabled={!outward.length && !inward.length}>
          <FileJson className="mr-2 h-4 w-4" /> GSTR-3B JSON
        </Button>
        <Button variant="outline" onClick={exportOutwardCsv} disabled={!outward.length}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Sales register
        </Button>
        <Button variant="outline" onClick={exportInwardCsv} disabled={!inward.length}>
          <Download className="mr-2 h-4 w-4" /> Purchase register
        </Button>
      </div>

      {issues.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {issues.length} thing(s) to fix before filing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm max-h-64 overflow-auto">
            {issues.map((i, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="font-medium">{i.invoiceNumber}</span>
                <span className="text-muted-foreground">{i.problem}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="outward">
        <TabsList>
          <TabsTrigger value="outward">Sales ({outward.length})</TabsTrigger>
          <TabsTrigger value="inward">Purchases ({inward.length})</TabsTrigger>
          <TabsTrigger value="eway">E-way bills ({data?.ewayBills.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="outward">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead>
                    <TableHead>GSTIN</TableHead><TableHead>Place of supply</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={10}>Loading…</TableCell></TableRow>}
                  {!isLoading && !outward.length && <TableRow><TableCell colSpan={10}>No sales invoices this month.</TableCell></TableRow>}
                  {outward.map((r) => (
                    <TableRow key={r.invoiceId}>
                      <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
                      <TableCell>{r.invoiceDate}</TableCell>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell>{r.customerGstin ?? <Badge variant="outline">B2C</Badge>}</TableCell>
                      <TableCell>{posLabel(r.stateCode)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.taxable)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.cgst)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.sgst)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.igst)}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inward">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!inward.length && <TableRow><TableCell colSpan={9}>No purchase bills recorded for this month.</TableCell></TableRow>}
                  {inward.map((r) => (
                    <TableRow key={r.billId}>
                      <TableCell className="font-medium">{r.billNumber}</TableCell>
                      <TableCell>{r.billDate}</TableCell>
                      <TableCell>{r.supplierName}</TableCell>
                      <TableCell>{r.supplierGstin ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatINR(r.taxable)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.cgst)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.sgst)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.igst)}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eway">
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-way bill</TableHead><TableHead>Dispatch</TableHead>
                    <TableHead>Date</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.ewayBills.length && <TableRow><TableCell colSpan={4}>No e-way bills this month.</TableCell></TableRow>}
                  {data?.ewayBills.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.number}</TableCell>
                      <TableCell>{e.dispatchNumber ?? '—'}</TableCell>
                      <TableCell>{String(e.date).slice(0, 10)}</TableCell>
                      <TableCell>{e.status ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
