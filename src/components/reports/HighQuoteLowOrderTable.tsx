import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHighQuoteLowOrderCustomers } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');
import { AlertTriangle } from 'lucide-react';

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function HighQuoteLowOrderTable({ dateFrom, dateTo }: Props) {
  const { data: customers, isLoading } = useHighQuoteLowOrderCustomers(15, dateFrom, dateTo);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            High Quote, Low Order Customers
          </CardTitle>
          <CardDescription>Customers who receive many quotes but place few orders</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No concerning patterns detected. Your quote-to-order conversion looks healthy!
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPotential = customers.reduce((sum, c) => sum + c.potential_revenue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          High Quote, Low Order Customers
        </CardTitle>
        <CardDescription>
          {customers.length} customers need attention • {formatCurrency(totalPotential)} potential revenue at risk
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[350px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Quotes</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Gap</TableHead>
                <TableHead className="text-right">Potential</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell className="font-medium max-w-[180px] truncate">{customer.company_name}</TableCell>
                  <TableCell className="text-center">{customer.quotes_received}</TableCell>
                  <TableCell className="text-center">{customer.orders_placed}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-amber-500 text-amber-600">{customer.conversion_gap}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(customer.potential_revenue)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{customer.recommendation}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
