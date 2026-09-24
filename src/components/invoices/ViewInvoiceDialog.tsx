import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Download, Mail, CreditCard, Building2 } from 'lucide-react';
import { InvoiceWithDetails, useInvoice } from '@/hooks/useInvoices';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { useState } from 'react';
import { RecordInvoicePaymentDialog } from './RecordInvoicePaymentDialog';
import { SendInvoiceEmailDialog } from './SendInvoiceEmailDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface ViewInvoiceDialogProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  cancelled: 'bg-destructive/10 text-destructive',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function ViewInvoiceDialog({ invoice: initialInvoice, open, onOpenChange }: ViewInvoiceDialogProps) {
  const { data: invoice, isLoading } = useInvoice(initialInvoice?.id);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { branding } = useTenantBranding();

  const handleDownloadPdf = () => {
    if (!invoice?.customer) return;
    
    // Determine if IGST or CGST+SGST based on place of supply
    const isIgst = invoice.is_igst;
    
    generateInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dispatchNumber: invoice.dispatch?.dispatch_number,
      buyersOrderNo: invoice.sales_order?.order_number,
      dispatchedThrough: 'BY COURIER',
      destination: invoice.place_of_supply || invoice.customer.state || '',
      billOfLading: invoice.dispatch ? `SELF dt. ${new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}` : undefined,
      // Consignee (Ship to)
      consignee: {
        company_name: invoice.customer.company_name,
        address: invoice.customer.address,
        city: invoice.customer.city,
        state: invoice.customer.state,
        pincode: invoice.customer.pincode,
      },
      // Buyer (Bill to)
      buyer: {
        company_name: invoice.customer.company_name,
        contact_person: invoice.customer.contact_person,
        address: invoice.customer.address,
        city: invoice.customer.city,
        state: invoice.customer.state,
        pincode: invoice.customer.pincode,
        gst_number: invoice.customer.gst_number,
        phone: invoice.customer.phone,
        email: invoice.customer.email,
      },
      items: invoice.items?.map(item => ({
        description: item.description,
        hsn_code: item.hsn_code || undefined,
        quantity: item.quantity,
        unit: item.unit || 'Nos',
        rate: item.rate,
        discount_percent: item.discount_percent || undefined,
        amount: item.amount,
        tax_percent: item.tax_percent || 18,
        tax_amount: item.tax_amount || 0,
      })) || [],
      subtotal: invoice.subtotal || 0,
      totalTax: invoice.total_tax || 0,
      grandTotal: invoice.grand_total,
      isIgst: isIgst,
      igstAmount: invoice.igst_amount || 0,
      cgstAmount: invoice.cgst_amount || 0,
      sgstAmount: invoice.sgst_amount || 0,
      declaration: invoice.notes ? invoice.notes.split('\n').filter(line => line.trim()) : undefined,
    });
  };

  const balance = (invoice?.grand_total || 0) - (invoice?.amount_paid || 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                Invoice {invoice?.invoice_number}
                {invoice && (
                  <Badge className={statusColors[invoice.status]} variant="secondary">
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
                {invoice?.status !== 'paid' && invoice?.status !== 'cancelled' && (
                  <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : invoice ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">From</h3>
                    <div className="mt-1">
                      <p className="font-semibold">{branding.companyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {branding.address1}, {branding.address2}, {branding.address3}
                      </p>
                      <p className="text-sm text-muted-foreground">GSTIN: {branding.gstin}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Bill To</h3>
                    <div className="mt-1">
                      <p className="font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {invoice.customer?.company_name}
                      </p>
                      {invoice.customer?.contact_person && (
                        <p className="text-sm">Attn: {invoice.customer.contact_person}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {[invoice.customer?.address, invoice.customer?.city, invoice.customer?.state, invoice.customer?.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {invoice.customer?.gst_number && (
                        <p className="text-sm text-muted-foreground">GSTIN: {invoice.customer.gst_number}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-4 gap-4 bg-muted/50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{format(new Date(invoice.invoice_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Place of Supply</p>
                  <p className="font-medium">{invoice.place_of_supply || invoice.customer?.state || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax Type</p>
                  <p className="font-medium">{invoice.is_igst ? 'IGST' : 'CGST + SGST'}</p>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <h3 className="font-medium mb-3">Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">HSN</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Tax</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items?.map((item, index) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">{index + 1}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.hsn_code || '-'}</td>
                          <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                          <td className="px-3 py-2 text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right">{item.tax_percent}%</td>
                          <td className="px-3 py-2 text-right font-medium">₹{item.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {invoice.total_discount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount:</span>
                      <span>-₹{invoice.total_discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {invoice.is_igst ? (
                    <div className="flex justify-between text-sm">
                      <span>IGST:</span>
                      <span>₹{invoice.igst_amount.toLocaleString('en-IN')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>CGST:</span>
                        <span>₹{invoice.cgst_amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>SGST:</span>
                        <span>₹{invoice.sgst_amount.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Grand Total:</span>
                    <span>₹{invoice.grand_total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Amount Paid:</span>
                    <span>₹{invoice.amount_paid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-600">
                    <span>Balance Due:</span>
                    <span>₹{balance.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div>
                  <h3 className="font-medium mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                </div>
              )}

              {invoice.terms_conditions && (
                <div>
                  <h3 className="font-medium mb-2">Terms & Conditions</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.terms_conditions}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <RecordInvoicePaymentDialog
        invoice={invoice || null}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />

      <SendInvoiceEmailDialog
        invoice={invoice || null}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />
    </>
  );
}
