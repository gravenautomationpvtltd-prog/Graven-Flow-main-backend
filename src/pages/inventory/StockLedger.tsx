import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { movementLabel, useStockLedger } from '@/hooks/useStockLedger';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

export default function StockLedger() {
  const [officeId, setOfficeId] = useState<string>('all');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState<string>('');
  const [productLabel, setProductLabel] = useState<string>('');

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['ledger-product-search', productSearch],
    enabled: productSearch.trim().length >= 2,
    queryFn: async () => {
      const term = productSearch.trim();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, model_number')
        .or(`model_number.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(8);
      if (error) throw error;
      return data as { id: string; name: string; model_number: string | null }[];
    },
  });

  const { data, isLoading } = useStockLedger({
    productId: productId || undefined,
    officeId: officeId === 'all' ? undefined : officeId,
    from,
    to,
  });

  const rows = data?.rows || [];

  const exportCsv = () => {
    const header = ['Date & time', 'Item', 'Warehouse', 'Movement', 'In', 'Out', 'Balance', 'By', 'Notes'];
    const lines = rows.map((r) => [
      format(new Date(r.created_at), 'dd-MM-yyyy HH:mm'),
      r.product?.model_number || r.product?.name || '',
      r.office?.name || '',
      movementLabel(r),
      r.qtyIn || '',
      r.qtyOut || '',
      r.balance,
      r.creator?.full_name || '',
      (r.notes || '').replace(/"/g, "'"),
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-ledger-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(
    () => [
      { label: 'Opening balance', value: data?.opening ?? 0 },
      { label: 'Came in', value: data?.totalIn ?? 0 },
      { label: 'Went out', value: data?.totalOut ?? 0 },
      { label: 'Remaining', value: data?.closing ?? 0 },
    ],
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Ledger</h1>
          <p className="text-muted-foreground">What came in, what went out and what remains — with date and time</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
          <div className="grid gap-2 relative">
            <Label>Item</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="All items — search model number"
                value={productId ? productLabel : productSearch}
                onChange={(e) => {
                  setProductId('');
                  setProductLabel('');
                  setProductSearch(e.target.value);
                }}
              />
            </div>
            {!productId && matches.length > 0 && (
              <div className="absolute top-full z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setProductId(m.id);
                      setProductLabel(m.model_number || m.name);
                      setProductSearch('');
                    }}
                  >
                    {m.model_number || m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Warehouse</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(s.value).toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; time</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Movement</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No stock movement in this period.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                  <TableCell className="font-medium">{r.product?.model_number || r.product?.name || '—'}</TableCell>
                  <TableCell>{r.office?.name || '—'}</TableCell>
                  <TableCell>
                    {movementLabel(r)}
                    {r.notes ? <div className="text-xs text-muted-foreground">{r.notes}</div> : null}
                  </TableCell>
                  <TableCell className="text-right text-green-600">{r.qtyIn || ''}</TableCell>
                  <TableCell className="text-right text-red-600">{r.qtyOut || ''}</TableCell>
                  <TableCell className="text-right font-medium">{r.balance}</TableCell>
                  <TableCell>{r.creator?.full_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
