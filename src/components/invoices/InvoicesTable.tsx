import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Download, Mail, MoreHorizontal, CreditCard, Trash2 } from 'lucide-react';
import { InvoiceWithDetails, useDeleteInvoice } from '@/hooks/useInvoices';
import { ViewInvoiceDialog } from './ViewInvoiceDialog';
import { RecordInvoicePaymentDialog } from './RecordInvoicePaymentDialog';
import { SendInvoiceEmailDialog } from './SendInvoiceEmailDialog';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

interface InvoicesTableProps {
  invoices: InvoiceWithDetails[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  cancelled: 'bg-destructive/10 text-destructive',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function InvoicesTable({ invoices, isLoading }: InvoicesTableProps) {
  const { isAdmin, isAccounts } = useAuth();
  const deleteInvoice = useDeleteInvoice();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDownloadPdf = (invoice: InvoiceWithDetails) => {
    if (!invoice.customer) return;
    
    const isIgst = invoice.is_igst;
    
    generateInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dispatchNumber: invoice.dispatch?.dispatch_number,
      buyersOrderNo: invoice.sales_order?.order_number,
      dispatchedThrough: 'BY COURIER',
      destination: invoice.place_of_supply || invoice.customer.state || '',
      consignee: {
        company_name: invoice.customer.company_name,
        address: invoice.customer.address,
        city: invoice.customer.city,
        state: invoice.customer.state,
        pincode: invoice.customer.pincode,
      },
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

  const handleDelete = async () => {
    if (!selectedInvoice) return;
    await deleteInvoice.mutateAsync(selectedInvoice.id);
    setDeleteDialogOpen(false);
    setSelectedInvoice(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No invoices found. Create your first invoice to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const balance = invoice.grand_total - invoice.amount_paid;
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setViewDialogOpen(true);
                      }}
                      className="text-primary hover:underline"
                    >
                      {invoice.invoice_number}
                    </button>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{invoice.customer?.company_name || '-'}</TableCell>
                  <TableCell className="text-right">
                    ₹{invoice.grand_total.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600">
                    ₹{invoice.amount_paid.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={balance > 0 ? 'text-amber-600 font-medium' : ''}>
                      ₹{balance.toLocaleString('en-IN')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[invoice.status]} variant="secondary">
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        {(isAdmin || isAccounts) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ViewInvoiceDialog
        invoice={selectedInvoice}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      <RecordInvoicePaymentDialog
        invoice={selectedInvoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />

      <SendInvoiceEmailDialog
        invoice={selectedInvoice}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Invoice"
        description="This will permanently delete this invoice and all associated data."
        itemDetails={selectedInvoice && (
          <>
            <p><strong>Invoice #:</strong> {selectedInvoice.invoice_number}</p>
            <p><strong>Customer:</strong> {selectedInvoice.customer?.company_name || '-'}</p>
            <p><strong>Amount:</strong> ₹{selectedInvoice.grand_total.toLocaleString('en-IN')}</p>
          </>
        )}
        isLoading={deleteInvoice.isPending}
      />
    </>
  );
}