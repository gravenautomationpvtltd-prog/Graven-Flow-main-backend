import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePaymentsHistory } from "@/hooks/useAccounts";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { RowActions } from "./RowActions";
import { PaymentEditDialog } from "./PaymentEditDialog";
import { DoubleConfirmDeleteDialog } from "@/components/ui/double-confirm-delete-dialog";
import { useDeletePayment } from "@/hooks/usePaymentActions";
import { useAuth } from "@/hooks/useAuth";

export function PaymentsHistory() {
  const [filter, setFilter] = useState<'all' | 'received' | 'paid'>('all');
  const { data: payments, isLoading } = usePaymentsHistory(filter === 'all' ? undefined : filter);
  const { isAccounts, isAdmin } = useAuth();
  const canManage = isAccounts || isAdmin;
  const del = useDeletePayment();
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment History</CardTitle>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {payments && payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={payment.type === 'received' ? 'default' : 'secondary'}
                      className={payment.type === 'received' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                    >
                      <span className="flex items-center gap-1">
                        {payment.type === 'received' ? (
                          <ArrowDownLeft className="h-3 w-3" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3" />
                        )}
                        {payment.type === 'received' ? 'Received' : 'Paid'}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{payment.partyName}</TableCell>
                  <TableCell>{payment.mode}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.reference || '-'}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${payment.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                    {payment.type === 'received' ? '+' : '-'}₹{payment.amount.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onView={payment.partyId
                        ? () => window.open(
                            payment.type === 'received'
                              ? `/customers/${payment.partyId}`
                              : `/suppliers/${payment.partyId}`,
                            '_blank',
                          )
                        : undefined}
                      viewLabel={payment.type === 'received' ? 'View customer' : 'View supplier'}
                      onEdit={canManage ? () => setEditing(payment as any) : undefined}
                      onDelete={canManage ? () => setDeleting(payment as any) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No payments found
          </div>
        )}
      </CardContent>

      <PaymentEditDialog payment={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />

      <DoubleConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await del.mutateAsync({ id: deleting.id, type: deleting.type });
          setDeleting(null);
        }}
        title="Delete payment"
        description="This removes the payment and updates the outstanding balance."
        itemDetails={deleting && (
          <>
            <p><strong>Party:</strong> {deleting.partyName}</p>
            <p><strong>Date:</strong> {format(new Date(deleting.date), 'dd MMM yyyy')}</p>
            <p><strong>Amount:</strong> ₹{Number(deleting.amount).toLocaleString('en-IN')}</p>
          </>
        )}
        isLoading={del.isPending}
      />
    </Card>
  );
}
