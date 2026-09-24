import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IndianRupee, Download, FileText, ExternalLink, Eye, ChevronRight } from 'lucide-react';
import { useSupplierPayments } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { PaymentDetailDialog } from './PaymentDetailDialog';

interface SupplierPaymentsTabProps {
  supplierId: string;
}

export function SupplierPaymentsTab({ supplierId }: SupplierPaymentsTabProps) {
  const navigate = useNavigate();
  const { data: payments, isLoading } = useSupplierPayments(supplierId);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Payments History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const handleDownload = (e: React.MouseEvent, url: string, fileName?: string) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'receipt';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewReceipt = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank');
  };

  const handleRowClick = (payment: any) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleNavigateToPO = (poId: string) => {
    setDialogOpen(false);
    navigate(`/procurement/purchase-orders/${poId}`);
  };

  const handlePOClick = (e: React.MouseEvent, poId: string) => {
    e.stopPropagation();
    navigate(`/procurement/purchase-orders/${poId}`);
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'bank_transfer':
      case 'neft':
      case 'rtgs':
      case 'imps':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'cheque':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'cash':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'upi':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Payments History ({payments?.length || 0})
          </CardTitle>
          <Badge variant="outline" className="text-base px-3 py-1 font-semibold">
            Total Paid: ₹{totalPaid.toLocaleString('en-IN')}
          </Badge>
        </CardHeader>
        <CardContent>
          {!payments || payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IndianRupee className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No payments recorded</p>
              <p className="text-sm mt-1">Payment history will appear here once payments are made</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Paid By</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Receipt</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow 
                      key={payment.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors group"
                      onClick={() => handleRowClick(payment)}
                    >
                      <TableCell className="font-medium">
                        {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {(payment.po as any)?.po_number ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className="font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={(e) => handlePOClick(e, (payment.po as any).id)}
                              >
                                {(payment.po as any).po_number}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>View Purchase Order</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge className={`capitalize cursor-default transition-colors ${getPaymentModeColor(payment.payment_mode)}`}>
                          {payment.payment_mode?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {payment.transaction_reference || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.bank_name || '-'}
                      </TableCell>
                      <TableCell>
                        {(payment.paid_by_profile as any)?.full_name || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {payment.notes || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payment.receipt_url ? (
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                                  onClick={(e) => handleDownload(e, payment.receipt_url!, `receipt-${payment.id}`)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download Receipt</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                                  onClick={(e) => handleViewReceipt(e, payment.receipt_url!)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Receipt</TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            <FileText className="h-4 w-4 opacity-30 mx-auto" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={selectedPayment}
        onNavigateToPO={handleNavigateToPO}
      />
    </TooltipProvider>
  );
}
