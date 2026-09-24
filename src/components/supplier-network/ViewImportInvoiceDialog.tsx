import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useImportInvoiceItems, useRecordImportPayment } from '@/hooks/useImportInvoices';
import { format } from 'date-fns';

interface Props {
  invoiceId: string | null;
  onClose: () => void;
}

export function ViewImportInvoiceDialog({ invoiceId, onClose }: Props) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice } = useQuery({
    queryKey: ['import-invoice', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_invoices')
        .select('*, suppliers:supplier_id(company_name), purchase_orders:po_id(po_number)')
        .eq('id', invoiceId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useImportInvoiceItems(invoiceId);
  const payMutation = useRecordImportPayment();

  if (!invoiceId) return null;

  const inv = invoice as any;
  const balance = inv ? Number(inv.grand_total_inr) - Number(inv.amount_paid) : 0;

  const handleRecordPayment = () => {
    const amt = Number(paymentAmount);
    if (amt <= 0 || !invoiceId) return;
    payMutation.mutate({ id: invoiceId, amount: amt }, {
      onSuccess: () => {
        setPaymentAmount('');
        setShowPayment(false);
      },
    });
  };

  return (
    <Dialog open={!!invoiceId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] grid grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {inv?.internal_ref}
            {inv?.status && (
              <Badge variant="secondary" className="capitalize">{inv.status}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>Supplier Invoice: {inv?.invoice_number}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto space-y-4 pr-2">
          {inv && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{inv.suppliers?.company_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">PO #</p>
                  <p className="font-medium">{inv.purchase_orders?.po_number || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currency / Rate</p>
                  <p className="font-medium">{inv.currency} @ ₹{Number(inv.exchange_rate)}</p>
                </div>
                {inv.bill_of_entry_number && (
                  <div>
                    <p className="text-muted-foreground">Bill of Entry</p>
                    <p className="font-medium">{inv.bill_of_entry_number}</p>
                  </div>
                )}
                {inv.awb_bl_number && (
                  <div>
                    <p className="text-muted-foreground">AWB / B/L</p>
                    <p className="font-medium">{inv.awb_bl_number}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <Separator />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total ({inv.currency})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items as any[]).map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.description}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">{Number(it.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(it.total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal ({inv.currency})</span><span>{Number(inv.subtotal).toFixed(2)}</span></div>
                  {Number(inv.shipping_charges) > 0 && <div className="flex justify-between"><span>Shipping</span><span>{Number(inv.shipping_charges).toFixed(2)}</span></div>}
                  {Number(inv.insurance) > 0 && <div className="flex justify-between"><span>Insurance</span><span>{Number(inv.insurance).toFixed(2)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-medium"><span>Grand Total ({inv.currency})</span><span>{Number(inv.grand_total).toFixed(2)}</span></div>
                  {Number(inv.customs_duty) > 0 && <div className="flex justify-between"><span>Customs Duty (₹)</span><span>₹{Number(inv.customs_duty).toLocaleString('en-IN')}</span></div>}
                  {Number(inv.igst_amount) > 0 && <div className="flex justify-between"><span>IGST (₹)</span><span>₹{Number(inv.igst_amount).toLocaleString('en-IN')}</span></div>}
                  {Number(inv.other_charges) > 0 && <div className="flex justify-between"><span>Other Charges (₹)</span><span>₹{Number(inv.other_charges).toLocaleString('en-IN')}</span></div>}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Landed Cost (INR)</span>
                    <span className="text-primary">₹{Number(inv.grand_total_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-green-600"><span>Paid</span><span>₹{Number(inv.amount_paid).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between font-semibold"><span>Balance</span><span>₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                </CardContent>
              </Card>

              {inv.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p>{inv.notes}</p>
                </div>
              )}

              {/* Payment */}
              {balance > 0 && (
                <>
                  {showPayment ? (
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Payment Amount (INR)</Label>
                        <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
                      </div>
                      <Button size="sm" onClick={handleRecordPayment} disabled={payMutation.isPending || Number(paymentAmount) <= 0}>
                        {payMutation.isPending ? 'Recording...' : 'Record'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setShowPayment(true)}>Record Payment</Button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
