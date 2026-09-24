import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, RefreshCw } from 'lucide-react';
import { useLedgerLines, useSeedAccounting } from '@/hooks/useBooks';
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTradingAccount,
  buildTrialBalance,
  formatINR,
  toCSV,
} from '@/lib/financial-statements';
import { downloadCSV } from '@/lib/csv-utils';

const firstOfFY = () => {
  const now = new Date();
  const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

export function BooksTab() {
  const [from, setFrom] = useState(firstOfFY());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [closingStock, setClosingStock] = useState(0);

  const { data: lines = [], isLoading } = useLedgerLines(from, to);
  const rebuild = useSeedAccounting();

  const trial = useMemo(() => buildTrialBalance(lines), [lines]);
  const trading = useMemo(() => buildTradingAccount(lines, { closingStock }), [lines, closingStock]);
  const pnl = useMemo(() => buildProfitAndLoss(lines, { closingStock }), [lines, closingStock]);
  const bs = useMemo(() => buildBalanceSheet(lines, { closingStock, netProfit: pnl.netProfit }), [lines, closingStock, pnl.netProfit]);

  const exportTrial = () =>
    downloadCSV(
      toCSV([
        ['Code', 'Account', 'Debit', 'Credit'],
        ...trial.rows.map((r) => [r.code, r.name, Math.max(r.balance, 0), Math.max(-r.balance, 0)]),
        ['', 'Total', trial.totalDebit, trial.totalCredit],
      ]),
      `trial-balance-${from}-to-${to}.csv`,
    );

  const exportPnl = () =>
    downloadCSV(
      toCSV([
        ['Particulars', 'Amount'],
        ['Sales', trading.sales],
        ['Purchases', trading.purchases],
        ['Direct expenses', trading.directExpenses],
        ['Closing stock', trading.closingStock],
        ['Gross profit', trading.grossProfit],
        ['Other income', pnl.otherIncome],
        ['Indirect expenses', pnl.indirectExpenses],
        ['Net profit', pnl.netProfit],
      ]),
      `profit-and-loss-${from}-to-${to}.csv`,
    );

  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold border-t pt-2 mt-1' : ''}`}>
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="books-from">From</Label>
              <Input id="books-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <Label htmlFor="books-to">To</Label>
              <Input id="books-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
            </div>
            <div>
              <Label htmlFor="books-stock">Closing stock</Label>
              <Input
                id="books-stock"
                type="number"
                value={closingStock}
                onChange={(e) => setClosingStock(Number(e.target.value) || 0)}
                className="w-[160px]"
              />
            </div>
          </div>
          <Button variant="outline" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${rebuild.isPending ? 'animate-spin' : ''}`} /> Rebuild books
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="trial">
        <TabsList>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="pnl">Trading & P&amp;L</TabsTrigger>
          <TabsTrigger value="bs">Balance sheet</TabsTrigger>
          <TabsTrigger value="daybook">Day book</TabsTrigger>
        </TabsList>

        <TabsContent value="trial">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Trial balance</CardTitle>
              <Button size="sm" variant="outline" onClick={exportTrial}><Download className="mr-2 h-4 w-4" />Export</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>}
                  {!isLoading && !trial.rows.length && <TableRow><TableCell colSpan={4}>No entries in this period.</TableCell></TableRow>}
                  {trial.rows.map((r) => (
                    <TableRow key={r.accountId}>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{r.balance > 0 ? formatINR(r.balance) : ''}</TableCell>
                      <TableCell className="text-right">{r.balance < 0 ? formatINR(-r.balance) : ''}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{formatINR(trial.totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatINR(trial.totalCredit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Trading account</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Row label="Sales" value={trading.sales} />
                <Row label="Closing stock" value={trading.closingStock} />
                <Row label="Purchases" value={-trading.purchases} />
                <Row label="Direct expenses" value={-trading.directExpenses} />
                <Row label="Gross profit" value={trading.grossProfit} bold />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Profit &amp; loss</CardTitle>
                <Button size="sm" variant="outline" onClick={exportPnl}><Download className="mr-2 h-4 w-4" />Export</Button>
              </CardHeader>
              <CardContent className="text-sm">
                <Row label="Gross profit" value={pnl.grossProfit} />
                <Row label="Other income" value={pnl.otherIncome} />
                <Row label="Indirect expenses" value={-pnl.indirectExpenses} />
                <Row label="Net profit" value={pnl.netProfit} bold />
                <div className="mt-4 space-y-1">
                  {pnl.expenseRows.map((r) => (
                    <div key={r.accountId} className="flex justify-between text-muted-foreground">
                      <span>{r.name}</span><span>{formatINR(r.balance)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bs">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Assets</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {bs.currentAssets.map((r) => <Row key={r.accountId} label={r.name} value={r.balance} />)}
                {bs.fixedAssets.map((r) => <Row key={r.accountId} label={r.name} value={r.balance} />)}
                <Row label="Closing stock" value={bs.closingStock} />
                <Row label="Total assets" value={bs.totalAssets} bold />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Liabilities &amp; equity</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {bs.currentLiabilities.map((r) => <Row key={r.accountId} label={r.name} value={-r.balance} />)}
                {bs.equity.map((r) => <Row key={r.accountId} label={r.name} value={-r.balance} />)}
                <Row label="Profit for the period" value={bs.netProfit} />
                <Row label="Total liabilities" value={bs.totalLiabilities} bold />
                {Math.abs(bs.difference) > 1 && (
                  <p className="text-xs text-destructive mt-2">
                    Difference of {formatINR(bs.difference)} — usually opening balances or closing stock still to be entered.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daybook">
          <Card>
            <CardContent className="p-0 overflow-auto max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Narration</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!lines.length && <TableRow><TableCell colSpan={6}>No entries in this period.</TableCell></TableRow>}
                  {lines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.entry_date}</TableCell>
                      <TableCell>{l.account?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{l.narration ?? ''}</TableCell>
                      <TableCell>{l.source_ref ?? ''}</TableCell>
                      <TableCell className="text-right">{Number(l.debit) ? formatINR(Number(l.debit)) : ''}</TableCell>
                      <TableCell className="text-right">{Number(l.credit) ? formatINR(Number(l.credit)) : ''}</TableCell>
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
