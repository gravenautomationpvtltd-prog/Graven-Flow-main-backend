import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useReceivablesSummary } from "@/hooks/useAccounts";
import { RowActions } from "./RowActions";

export function ReceivablesTable() {
  const { data: receivables, isLoading } = useReceivablesSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Receivables</CardTitle>
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
      <CardHeader>
        <CardTitle>Customer Receivables</CardTitle>
      </CardHeader>
      <CardContent>
        {receivables && receivables.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Total Invoiced</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Aging Breakdown</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.map((item) => (
                <TableRow key={item.customerId}>
                  <TableCell className="font-medium">{item.customerName}</TableCell>
                  <TableCell>₹{item.totalInvoiced.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{item.totalPaid.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="font-semibold text-green-600">
                    ₹{item.balance.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {item.current > 0 && <Badge variant="secondary">Current: ₹{item.current.toLocaleString('en-IN')}</Badge>}
                      {item.days30 > 0 && <Badge className="bg-yellow-100 text-yellow-800">30d: ₹{item.days30.toLocaleString('en-IN')}</Badge>}
                      {item.days60 > 0 && <Badge className="bg-orange-100 text-orange-800">60d: ₹{item.days60.toLocaleString('en-IN')}</Badge>}
                      {item.days90Plus > 0 && <Badge variant="destructive">90d+: ₹{item.days90Plus.toLocaleString('en-IN')}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onView={() => window.open(`/customers/${item.customerId}`, '_blank')}
                      viewLabel="View customer"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No receivables found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
