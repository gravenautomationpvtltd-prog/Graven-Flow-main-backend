import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCustomerHealthReport } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function CustomerHealthTable({ dateFrom, dateTo }: Props) {
  const { data: customers, isLoading } = useCustomerHealthReport(25, dateFrom, dateTo);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[400px] w-full" /></CardContent>
      </Card>
    );
  }

  const healthBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-600">Healthy</Badge>;
      case 'at_risk': return <Badge variant="outline" className="border-amber-500 text-amber-600">At Risk</Badge>;
      case 'churned': return <Badge variant="destructive">Churned</Badge>;
      case 'new': return <Badge variant="secondary">New</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const healthCounts = {
    healthy: customers?.filter(c => c.health_status === 'healthy').length || 0,
    at_risk: customers?.filter(c => c.health_status === 'at_risk').length || 0,
    churned: customers?.filter(c => c.health_status === 'churned').length || 0,
    new: customers?.filter(c => c.health_status === 'new').length || 0,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Health Report</CardTitle>
        <CardDescription>Customer engagement and conversion status</CardDescription>
        <div className="flex gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <span className="text-xs">{healthCounts.healthy} Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs">{healthCounts.at_risk} At Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs">{healthCounts.churned} Churned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-xs">{healthCounts.new} New</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Quotes</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-center">Days Since Order</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => (
                <TableRow key={customer.customer_id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{customer.company_name}</TableCell>
                  <TableCell className="text-center">{customer.total_leads}</TableCell>
                  <TableCell className="text-center">{customer.total_quotes}</TableCell>
                  <TableCell className="text-center">{customer.total_orders}</TableCell>
                  <TableCell className="text-right">{formatCurrency(customer.total_revenue)}</TableCell>
                  <TableCell className="text-center">{customer.days_since_last_order !== null ? customer.days_since_last_order : '-'}</TableCell>
                  <TableCell className="text-center">{healthBadge(customer.health_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
