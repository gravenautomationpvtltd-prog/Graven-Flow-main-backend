import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, FileText, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useImportInvoices, useImportInvoiceStats } from '@/hooks/useImportInvoices';
import { CreateImportInvoiceDialog } from '@/components/supplier-network/CreateImportInvoiceDialog';
import { ViewImportInvoiceDialog } from '@/components/supplier-network/ViewImportInvoiceDialog';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  partial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function ImportInvoices() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useImportInvoices();
  const { data: stats } = useImportInvoiceStats();

  const filtered = useMemo(() => {
    let list = invoices as any[];
    if (tab !== 'all') list = list.filter((i: any) => i.status === tab);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((i: any) =>
        i.invoice_number?.toLowerCase().includes(s) ||
        i.internal_ref?.toLowerCase().includes(s) ||
        i.suppliers?.company_name?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [invoices, tab, search]);

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Invoices</h1>
          <p className="text-muted-foreground">Track invoices from international suppliers with multi-currency support</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Import Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.count ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Import Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(stats?.totalINR ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{fmt(stats?.pending ?? 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{fmt(stats?.totalPaid ?? 0)}</p></CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="partial">Partial</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref #</TableHead>
                  <TableHead>Supplier Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO #</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">INR Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No import invoices found</TableCell></TableRow>
                ) : filtered.map((inv: any) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewId(inv.id)}>
                    <TableCell className="font-mono text-xs">{inv.internal_ref}</TableCell>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.suppliers?.company_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.purchase_orders?.po_number || '—'}</TableCell>
                    <TableCell>{inv.currency}</TableCell>
                    <TableCell className="text-right">{Number(inv.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(inv.grand_total_inr))}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[inv.status] || ''} variant="secondary">{inv.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateImportInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ViewImportInvoiceDialog invoiceId={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}
