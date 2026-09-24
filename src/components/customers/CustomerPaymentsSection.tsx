import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus, Receipt, ExternalLink } from 'lucide-react';
import { useCustomerPayments } from '@/hooks/useCustomerPayments';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CustomerPaymentsSectionProps {
  customerId: string;
  customerName: string;
}

const paymentModeLabels: Record<string, string> = {
  neft: 'NEFT',
  rtgs: 'RTGS',
  upi: 'UPI',
  cheque: 'Cheque',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

export function CustomerPaymentsSection({ customerId, customerName }: CustomerPaymentsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: payments, isLoading } = useCustomerPayments(customerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5" />
              Payments ({payments?.length || 0})
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          </div>
          {totalPayments > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: {formatCurrency(totalPayments)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!payments || payments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No payments recorded yet
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        +{formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {paymentModeLabels[payment.payment_mode] || payment.payment_mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.transaction_reference || '-'}
                      </TableCell>
                      <TableCell>
                        {payment.receipt_url && (
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Receipt className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        customerName={customerName}
      />
    </>
  );
}
