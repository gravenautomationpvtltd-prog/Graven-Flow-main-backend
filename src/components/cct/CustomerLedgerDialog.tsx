import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCustomer } from '@/hooks/useCustomers';
import { useCustomerPOLedger } from '@/hooks/useAccountsCustomerLedger';
import { History, Wallet } from 'lucide-react';

function fmtINR(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
}

function paymentStatus(value: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0) return 'unpaid';
  if (paid >= value) return 'paid';
  return 'partial';
}

function PayBadge({ status }: { status: 'unpaid' | 'partial' | 'paid' }) {
  const variant = status === 'paid' ? 'default' : status === 'partial' ? 'secondary' : 'destructive';
  return <Badge variant={variant} className="capitalize text-[10px]">{status}</Badge>;
}

interface Props {
  customerId: string | null;
  onClose: () => void;
}

export function CustomerLedgerDialog({ customerId, onClose }: Props) {
  const { data: customer } = useCustomer(customerId ?? undefined);
  const { data: ledger = [], isLoading } = useCustomerPOLedger(customerId ?? undefined);

  const totals = useMemo(() => {
    const value = ledger.reduce((s, e) => s + Number(e.grand_total || 0), 0);
    const paid = ledger.reduce((s, e) => s + Number(e.totalPaid || 0), 0);
    return { value, paid, balance: Math.max(0, value - paid) };
  }, [ledger]);

  // Build chronological ledger entries (invoices DR, payments CR) with running balance
  const entries = useMemo(() => {
    type Row = { date: string; type: 'invoice' | 'payment'; ref: string; order: string; debit: number; credit: number };
    const rows: Row[] = [];
    for (const o of ledger) {
      for (const inv of o.invoices) {
        rows.push({
          date: inv.invoice_date,
          type: 'invoice',
          ref: inv.invoice_number,
          order: o.order_number,
          debit: Number(inv.grand_total || 0),
          credit: 0,
        });
      }
      for (const p of o.payments) {
        rows.push({
          date: p.payment_date,
          type: 'payment',
          ref: p.transaction_reference || p.payment_mode,
          order: o.order_number,
          debit: 0,
          credit: Number(p.amount || 0),
        });
      }
    }
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return rows.map(r => { running += r.debit - r.credit; return { ...r, balance: running }; });
  }, [ledger]);

  return (
    <Dialog open={!!customerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Customer History — <span className="text-muted-foreground font-normal">{customer?.company_name ?? '…'}</span>
          </DialogTitle>
          <DialogDescription>Order & payment history with running ledger.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer + Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{customer?.company_name ?? '—'}</div>
                {customer?.contact_person && <div className="text-muted-foreground">{customer.contact_person}</div>}
                {customer?.gst_number && <div>GST: <span className="font-mono">{customer.gst_number}</span></div>}
                {customer?.phone && <div>📞 {customer.phone}</div>}
                {customer?.email && <div>✉️ {customer.email}</div>}
                {(customer?.address || customer?.city) && (
                  <div className="text-muted-foreground text-xs pt-1">
                    {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Wallet className="h-4 w-4" /> Lifetime Totals</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Orders</span><span className="font-medium">{ledger.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lifetime Value</span><span className="font-medium">{fmtINR(totals.value)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Received</span><span className="text-green-600 font-medium">{fmtINR(totals.paid)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="text-amber-600 font-medium">{fmtINR(totals.balance)}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Orders history */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Orders History</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((o) => {
                      const ps = paymentStatus(o.grand_total, o.totalPaid);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.order_number}</TableCell>
                          <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{fmtINR(o.grand_total)}</TableCell>
                          <TableCell className="text-right text-green-600">{fmtINR(o.totalPaid)}</TableCell>
                          <TableCell className="text-right text-amber-600">{fmtINR(o.balance)}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize text-[10px]">{(o.status || '').replace(/_/g, ' ')}</Badge></TableCell>
                          <TableCell><PayBadge status={ps} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ledger</CardTitle></CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={r.type === 'invoice' ? 'secondary' : 'default'} className="capitalize text-[10px]">{r.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.order}</TableCell>
                        <TableCell className="text-right">{r.debit ? fmtINR(r.debit) : '—'}</TableCell>
                        <TableCell className="text-right text-green-600">{r.credit ? fmtINR(r.credit) : '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${r.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{fmtINR(r.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
