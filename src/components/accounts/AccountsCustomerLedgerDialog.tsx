import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, IndianRupee, Package, CreditCard, FileText, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useCustomerPOLedger, type POLedgerEntry } from '@/hooks/useAccountsCustomerLedger';
import type { AccountsCustomerSummary } from '@/hooks/useAccountsCustomerLedger';

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
  customer: AccountsCustomerSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountsCustomerLedgerDialog({ customer, open, onOpenChange }: Props) {
  const { data: poLedger, isLoading } = useCustomerPOLedger(customer.id);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const totalValue = poLedger?.reduce((s, po) => s + po.grand_total, 0) || 0;
  const totalPaid = poLedger?.reduce((s, po) => s + po.totalPaid, 0) || 0;
  const totalBalance = totalValue - totalPaid;
  const totalPOs = poLedger?.length || 0;

  const toggleExpand = (id: string) => {
    setExpandedPO(prev => prev === id ? null : id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{customer.company_name} — Ledger</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {customer.contact_person && `${customer.contact_person} · `}{customer.phone}
            {customer.city && ` · ${customer.city}`}
          </p>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Package} label="Total POs" value={String(totalPOs)} />
          <SummaryCard icon={IndianRupee} label="Order Value" value={fmt(totalValue)} />
          <SummaryCard icon={CreditCard} label="Paid" value={fmt(totalPaid)} className="text-emerald-700" />
          <SummaryCard icon={IndianRupee} label="Outstanding" value={fmt(Math.max(0, totalBalance))} className="text-destructive" />
        </div>

        <Separator />

        {/* PO-wise Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !poLedger?.length ? (
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
                <TableHead className="text-right">Order Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poLedger.map(po => (
                <PORow key={po.id} po={po} expanded={expandedPO === po.id} onToggle={() => toggleExpand(po.id)} />
              ))}
              {/* Totals row */}
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
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <span className={`text-lg font-bold ${className || ''}`}>{value}</span>
      </CardContent>
    </Card>
  );
}

function PORow({ po, expanded, onToggle }: { po: POLedgerEntry; expanded: boolean; onToggle: () => void }) {
  const hasDetails = po.invoices.length > 0 || po.dispatches.length > 0 || po.payments.length > 0;

  return (
    <>
      <TableRow className={`cursor-pointer ${expanded ? 'bg-muted/30' : ''}`} onClick={onToggle}>
        <TableCell className="w-8">
          {hasDetails ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : null}
        </TableCell>
        <TableCell>
          <div className="font-medium">{po.order_number}</div>
          {po.customer_po_number && <div className="text-xs text-muted-foreground">PO: {po.customer_po_number}</div>}
        </TableCell>
        <TableCell className="text-sm">{fmtDate(po.created_at)}</TableCell>
        <TableCell>
          {po.invoices.length > 0 ? (
            <div className="space-y-0.5">
              {po.invoices.map(inv => (
                <div key={inv.id} className="text-xs">{inv.invoice_number}</div>
              ))}
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

      {/* Expanded detail */}
      {expanded && hasDetails && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dispatches */}
              <DetailSection
                icon={Truck}
                title="Dispatches"
                items={po.dispatches}
                renderItem={d => (
                  <div key={d.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{d.dispatch_number}</span>
                      <span className="text-muted-foreground ml-2">{fmtDate(d.dispatch_date)}</span>
                    </div>
                    <Badge variant={statusColor(d.status)} className="text-xs capitalize">{d.status}</Badge>
                  </div>
                )}
              />

              {/* Payments */}
              <DetailSection
                icon={CreditCard}
                title="Payments"
                items={po.payments}
                renderItem={p => (
                  <div key={p.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{fmt(p.amount)}</span>
                      <span className="text-muted-foreground ml-2">{fmtDate(p.payment_date)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{p.payment_mode}</span>
                  </div>
                )}
              />

              {/* Invoices */}
              <DetailSection
                icon={FileText}
                title="Invoices"
                items={po.invoices}
                renderItem={inv => (
                  <div key={inv.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <div>
                      <span className="font-medium">{inv.invoice_number}</span>
                      <span className="text-muted-foreground ml-2">{fmtDate(inv.invoice_date)}</span>
                    </div>
                    <span className="text-xs font-medium">{fmt(inv.grand_total)}</span>
                  </div>
                )}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailSection<T>({ icon: Icon, title, items, renderItem }: {
  icon: any; title: string; items: T[]; renderItem: (item: T) => React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" /> {title} ({items.length})
      </div>
      <div>{items.map(renderItem)}</div>
    </div>
  );
}
