import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayablesSummary } from "@/hooks/useAccounts";
import { RowActions } from "./RowActions";

export function PayablesTable() {
  const { data: payables, isLoading } = usePayablesSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supplier Payables</CardTitle>
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
        <CardTitle>Supplier Payables</CardTitle>
      </CardHeader>
      <CardContent>
        {payables && payables.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Total PO Value</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payables.map((item) => (
                <TableRow key={item.supplierId}>
                  <TableCell className="font-medium">{item.supplierName}</TableCell>
                  <TableCell>₹{item.totalPOValue.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{item.totalPaid.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="font-semibold text-red-600">
                    ₹{item.balance.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onView={() => window.open(`/suppliers/${item.supplierId}`, '_blank')}
                      viewLabel="View supplier"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No payables found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
