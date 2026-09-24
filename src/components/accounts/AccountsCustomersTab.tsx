import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, IndianRupee, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccountsCustomers, type AccountsCustomerSummary } from '@/hooks/useAccountsCustomerLedger';
import { AccountsCustomerLedgerDialog } from './AccountsCustomerLedgerDialog';
import { RowActions } from './RowActions';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

export function AccountsCustomersTab() {
  const [search, setSearch] = useState('');
  const [ledgerCustomer, setLedgerCustomer] = useState<AccountsCustomerSummary | null>(null);
  const { data: customers, isLoading } = useAccountsCustomers(search);
  const navigate = useNavigate();

  const totalCustomers = customers?.length || 0;
  const totalOutstanding = customers?.reduce((s, c) => s + Math.max(0, c.balance), 0) || 0;
  const totalCollected = customers?.reduce((s, c) => s + c.totalPaid, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalCustomers}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              <span className="text-2xl font-bold text-emerald-700">{formatCurrency(totalCollected)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold text-destructive">{formatCurrency(totalOutstanding)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">POs</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !customers?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No customers with orders found
                  </TableCell>
                </TableRow>
              ) : (
                customers.map(customer => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => window.open(`/customers/${customer.id}`, '_blank')}
                  >
                    <TableCell>
                      <div className="font-medium">{customer.company_name}</div>
                      {customer.city && <div className="text-xs text-muted-foreground">{customer.city}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{customer.contact_person || '—'}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{customer.totalPOs}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(customer.totalValue)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatCurrency(customer.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      <span className={customer.balance > 0 ? 'text-destructive font-semibold' : 'text-emerald-700'}>
                        {formatCurrency(Math.max(0, customer.balance))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLedgerCustomer(customer);
                            }}
                          >
                            <BookOpen className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Ledger</TooltipContent>
                      </Tooltip>
                      <RowActions
                        onView={() => setLedgerCustomer(customer)}
                        viewLabel="View ledger"
                        onEdit={() => window.open(`/customers/${customer.id}`, '_blank')}
                        editLabel="Open customer"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ledger Dialog */}
      {ledgerCustomer && (
        <AccountsCustomerLedgerDialog
          customer={ledgerCustomer}
          open={!!ledgerCustomer}
          onOpenChange={open => { if (!open) setLedgerCustomer(null); }}
        />
      )}
    </div>
  );
}
