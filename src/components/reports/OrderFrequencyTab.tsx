import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, ArrowUpDown, Download, Repeat, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { useOrderFrequencyReport, type OrderFrequencyRow } from '@/hooks/useOrderFrequencyReport';

interface Props {
  dateRange?: { from?: Date; to?: Date };
}

type SortKey = 'customer' | 'owner' | 'orders' | 'value' | 'first_order' | 'last_order' | 'avg_gap' | 'days_since' | 'expected_next' | 'status';
type SortDir = 'asc' | 'desc';
type FilterKey = 'all' | 'repeat' | 'overdue';
type PeriodKey = 'all' | '12m';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

const statusBadge = (status: OrderFrequencyRow['status']) => {
  switch (status) {
    case 'on_track': return <Badge className="bg-green-600">On track</Badge>;
    case 'due_now': return <Badge variant="outline" className="border-amber-500 text-amber-600">Due now</Badge>;
    case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
    default: return <Badge variant="secondary">Single order</Badge>;
  }
};

const statusRank: Record<OrderFrequencyRow['status'], number> = {
  overdue: 0,
  due_now: 1,
  on_track: 2,
  single_order: 3,
};

interface ColumnDef {
  key: SortKey;
  label: string;
  align?: 'left' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'owner', label: 'Owner' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'value', label: 'Total Value', align: 'right' },
  { key: 'first_order', label: 'First Order' },
  { key: 'last_order', label: 'Last Order' },
  { key: 'avg_gap', label: 'Avg Gap', align: 'right' },
  { key: 'days_since', label: 'Days Since', align: 'right' },
  { key: 'expected_next', label: 'Expected Next' },
  { key: 'status', label: 'Status' },
];

const compareRows = (a: OrderFrequencyRow, b: OrderFrequencyRow, key: SortKey): number => {
  switch (key) {
    case 'customer':
      return a.customerName.localeCompare(b.customerName);
    case 'owner':
      return (a.ownerName || '').localeCompare(b.ownerName || '');
    case 'orders':
      return a.totalOrders - b.totalOrders;
    case 'value':
      return a.totalValue - b.totalValue;
    case 'first_order':
      return new Date(a.firstOrderDate).getTime() - new Date(b.firstOrderDate).getTime();
    case 'last_order':
      return new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime();
    case 'avg_gap':
      return (a.avgGapDays ?? -1) - (b.avgGapDays ?? -1);
    case 'days_since':
      return a.daysSinceLastOrder - b.daysSinceLastOrder;
    case 'expected_next': {
      const ta = a.expectedNextOrderDate ? new Date(a.expectedNextOrderDate).getTime() : -1;
      const tb = b.expectedNextOrderDate ? new Date(b.expectedNextOrderDate).getTime() : -1;
      return ta - tb;
    }
    case 'status':
      return statusRank[a.status] - statusRank[b.status];
    default:
      return 0;
  }
};

export function OrderFrequencyTab(_props: Props) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('all');
  const sinceDate = useMemo(() => {
    if (period !== '12m') return undefined;
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d;
  }, [period]);
  const { data, isLoading } = useOrderFrequencyReport(sinceDate);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('days_since');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<FilterKey>('all');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // sensible default direction per column type
      const numericKeys: SortKey[] = ['orders', 'value', 'avg_gap', 'days_since'];
      setSortDir(numericKeys.includes(key) ? 'desc' : 'asc');
    }
  };

  const rows = useMemo(() => {
    let list = data ?? [];
    if (filter === 'repeat') list = list.filter(r => r.totalOrders >= 2);
    if (filter === 'overdue') list = list.filter(r => r.status === 'overdue');
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => r.customerName.toLowerCase().includes(q));
    const sorted = [...list].sort((a, b) => compareRows(a, b, sortKey));
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [data, filter, search, sortKey, sortDir]);

  const summary = useMemo(() => {
    const all = data ?? [];
    const repeat = all.filter(r => r.avgGapDays !== null);
    const avgGap = repeat.length
      ? Math.round(repeat.reduce((s, r) => s + (r.avgGapDays || 0), 0) / repeat.length)
      : null;
    return {
      repeatCustomers: repeat.length,
      totalCustomers: all.length,
      avgGap,
      overdue: all.filter(r => r.status === 'overdue').length,
    };
  }, [data]);

  const handleExport = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const headers = ['Customer', 'Owner', 'Orders', 'Total Value (INR)', 'First Order', 'Last Order', 'Avg Gap (days)', 'Days Since Last Order', 'Expected Next Order', 'Status'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.customerName, r.ownerName || '', r.totalOrders, r.totalValue,
        format(new Date(r.firstOrderDate), 'yyyy-MM-dd'),
        format(new Date(r.lastOrderDate), 'yyyy-MM-dd'),
        r.avgGapDays ?? '',
        r.daysSinceLastOrder,
        r.expectedNextOrderDate ? format(new Date(r.expectedNextOrderDate), 'yyyy-MM-dd') : '',
        r.status,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-frequency-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} customers`);
  };

  const renderSortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 inline" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 inline" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[400px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Repeat customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.repeatCustomers}</p>
            <p className="text-xs text-muted-foreground">of {summary.totalCustomers} ordering customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Average order gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.avgGap !== null ? `${summary.avgGap} days` : '-'}</p>
            <p className="text-xs text-muted-foreground">Across repeat customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Overdue to order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.overdue}</p>
            <p className="text-xs text-muted-foreground">Past their expected next order</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Customer Order Frequency</CardTitle>
              <CardDescription>
                How often each customer orders and who is overdue — based on {period === 'all' ? 'all orders ever recorded' : 'orders from the last 12 months'}. Click any column header to sort.
              </CardDescription>

            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 pt-3">
            <Input
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="repeat">Repeat customers only</SelectItem>
                <SelectItem value="overdue">Overdue only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => {
              const [k, d] = v.split(':') as [SortKey, SortDir];
              setSortKey(k);
              setSortDir(d);
            }}>
              <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map(c => (
                  <SelectItem key={c.key} value={`${c.key}:asc`}>{c.label} — ascending</SelectItem>
                ))}
                {COLUMNS.map(c => (
                  <SelectItem key={`${c.key}-d`} value={`${c.key}:desc`}>{c.label} — descending</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map(col => (
                    <TableHead
                      key={col.key}
                      className={`cursor-pointer select-none hover:bg-muted/50 ${col.align === 'right' ? 'text-right' : ''}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className={col.align === 'right' ? 'inline-flex items-center justify-end' : 'inline-flex items-center'}>
                        {col.label}{renderSortIcon(col.key)}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {(data?.length ?? 0) === 0
                        ? 'No customer orders available yet'
                        : 'No customers match the current search or filter'}
                    </TableCell>
                  </TableRow>

                ) : rows.map((r) => (
                  <TableRow
                    key={r.customerId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/customers/${r.customerId}`)}
                  >
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.ownerName || '-'}</TableCell>
                    <TableCell className="text-right">{r.totalOrders}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.totalValue)}</TableCell>
                    <TableCell>{format(new Date(r.firstOrderDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{format(new Date(r.lastOrderDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">{r.avgGapDays ? `${r.avgGapDays} d` : '-'}</TableCell>
                    <TableCell className="text-right">{r.daysSinceLastOrder} d</TableCell>
                    <TableCell>
                      {r.expectedNextOrderDate ? format(new Date(r.expectedNextOrderDate), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
