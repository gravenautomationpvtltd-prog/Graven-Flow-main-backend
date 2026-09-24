import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCustomerLedger } from '@/hooks/useCustomerPayments';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CustomerLedgerSectionProps {
  customerId: string;
}

export function CustomerLedgerSection({ customerId }: CustomerLedgerSectionProps) {
  const { data, isLoading } = useCustomerLedger(customerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  const ledgerEntries = data?.ledgerEntries || [];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const currentBalance = ledgerEntries.length > 0 
    ? ledgerEntries[ledgerEntries.length - 1].balance 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" />
            Account Ledger
          </CardTitle>
          <Badge variant={currentBalance > 0 ? 'destructive' : currentBalance < 0 ? 'default' : 'secondary'}>
            Balance: {formatCurrency(currentBalance)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {ledgerEntries.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry, index) => (
                  <TableRow key={`${entry.type}-${entry.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.type === 'debit' ? (
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-green-500" />
                        )}
                        <div>
                          <div className="font-medium">{entry.description}</div>
                          <div className="text-xs text-muted-foreground">{entry.reference}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={entry.balance > 0 ? 'text-red-600' : entry.balance < 0 ? 'text-green-600' : ''}>
                        {formatCurrency(Math.abs(entry.balance))}
                        {entry.balance !== 0 && (entry.balance > 0 ? ' Dr' : ' Cr')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
