import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, IndianRupee, Package, CreditCard, FileText, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerPOLedger, type POLedgerEntry } from '@/hooks/useAccountsCustomerLedger';

const fmt = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const fmtDate = (d: string | null) => d ? format(new Date(d), 'dd MMM yyyy') : '—';

const statusColor = (s: string) => {
  const map: Record<string, string> = {
    confirmed: 'default', fulfilled: 'default', pending: 'secondary',
    delivered: 'default', shipped: 'secondary', draft: 'outline',
  };
  return (map[s] || 'secondary') as any;
};

interface Props {
  customerId: string;
}

export function CustomerPOLedgerSection({ customerId }: Props) {
  const { data: poLedger, isLoading } = useCustomerPOLedger(customerId);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const totalValue = poLedger?.reduce((s, po) => s + po.grand_total, 0) || 0;
  const totalPaid = poLedger?.reduce((s, po) => s + po.totalPaid, 0) || 0;
  const totalBalance = totalValue - totalPaid;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-48" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5" />
            PO-wise Ledger
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span>Total: <strong>{fmt(totalValue)}</strong></span>
            <span className="text-emerald-700">Paid: <strong>{fmt(totalPaid)}</strong></span>
            <Badge variant={totalBalance > 0 ? 'destructive' : 'secondary'}>
              Due: {fmt(Math.max(0, totalBalance))}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!poLedger?.length ? (
          <p className="text-center py-8 text-muted-foreground">No orders found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>PO / Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Dispatches</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poLedger.map(po => {
                const hasDetails = po.invoices.length > 0 || po.dispatches.length > 0 || po.payments.length > 0;
                const expanded = expandedPO === po.id;
                return (
                  <PORowInline
                    key={po.id}
                    po={po}
                    expanded={expanded}
                    hasDetails={hasDetails}
                    onToggle={() => setExpandedPO(prev => prev === po.id ? null : po.id)}
                  />
                );
              })}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={5} className="text-right">Totals</TableCell>
                <TableCell className="text-right">{fmt(totalValue)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(totalPaid)}</TableCell>
                <TableCell className="text-right text-destructive">{fmt(Math.max(0, totalBalance))}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PORowInline({ po, expanded, hasDetails, onToggle }: {
  po: POLedgerEntry; expanded: boolean; hasDetails: boolean; onToggle: () => void;
}) {
  return (
    <>
      <TableRow className={`cursor-pointer ${expanded ? 'bg-muted/30' : ''}`} onClick={onToggle}>
        <TableCell className="w-8">
          {hasDetails ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
        </TableCell>
        <TableCell>
          <div className="font-medium">{po.order_number}</div>
          {po.customer_po_number && <div className="text-xs text-muted-foreground">PO: {po.customer_po_number}</div>}
        </TableCell>
        <TableCell className="text-sm">{fmtDate(po.created_at)}</TableCell>
        <TableCell>
          {po.invoices.length > 0 ? (
            <div className="space-y-0.5">
              {po.invoices.map(inv => <div key={inv.id} className="text-xs">{inv.invoice_number}</div>)}
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {po.dispatches.length > 0 ? (
            <Badge variant="secondary" className="text-xs">{po.dispatches.length} dispatch{po.dispatches.length > 1 ? 'es' : ''}</Badge>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right font-medium">{fmt(po.grand_total)}</TableCell>
        <TableCell className="text-right text-emerald-700">{fmt(po.totalPaid)}</TableCell>
        <TableCell className="text-right">
          <span className={po.balance > 0 ? 'text-destructive font-semibold' : 'text-emerald-700'}>
            {fmt(Math.max(0, po.balance))}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={statusColor(po.status)} className="text-xs capitalize">{po.status}</Badge>
        </TableCell>
      </TableRow>

      {expanded && hasDetails && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {po.dispatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-muted-foreground">
                    <Truck className="h-4 w-4" /> Dispatches ({po.dispatches.length})
                  </div>
                  {po.dispatches.map(d => (
                    <div key={d.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{d.dispatch_number}</span>
                        <span className="text-muted-foreground ml-2">{fmtDate(d.dispatch_date)}</span>
                      </div>
                      <Badge variant={statusColor(d.status)} className="text-xs capitalize">{d.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {po.payments.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-muted-foreground">
                    <CreditCard className="h-4 w-4" /> Payments ({po.payments.length})
                  </div>
                  {po.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{fmt(p.amount)}</span>
                        <span className="text-muted-foreground ml-2">{fmtDate(p.payment_date)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{p.payment_mode}</span>
                    </div>
                  ))}
                </div>
              )}
              {po.invoices.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-muted-foreground">
                    <FileText className="h-4 w-4" /> Invoices ({po.invoices.length})
                  </div>
                  {po.invoices.map(inv => (
                    <div key={inv.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{inv.invoice_number}</span>
                        <span className="text-muted-foreground ml-2">{fmtDate(inv.invoice_date)}</span>
                      </div>
                      <span className="text-xs font-medium">{fmt(inv.grand_total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
