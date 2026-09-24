import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, ArrowUpDown, Search } from 'lucide-react';
import type { CustomerBreakdown } from '@/hooks/useQuotationAnalytics';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { CustomerDrilldownDialog } from './CustomerDrilldownDialog';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  data: CustomerBreakdown[];
  staffFilter: string | null;
  staffFilterName: string | null;
  dateRange: { from?: Date; to?: Date };
}

type SortKey = 'quotationCount' | 'convertedCount' | 'conversionRate' | 'totalQuotedValue' | 'totalWonValue' | 'enquiryCount' | 'priceMatchedCount' | 'matchedConversionRate';

export function CustomerQuotationTable({ data, staffFilter, staffFilterName, dateRange }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalQuotedValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [drilldown, setDrilldown] = useState<{ customerId: string; customerName: string } | null>(null);

  const filtered = useMemo(() => {
    let items = data;
    if (search) items = items.filter(c => c.customerName.toLowerCase().includes(search.toLowerCase()));
    return [...items].sort((a, b) => sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]);
  }, [data, search, sortKey, sortDesc]);

  // Reset page when search/sort changes
  useMemo(() => {
    setCurrentPage(0);
  }, [search, sortKey, sortDesc]);

  const paginatedData = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
  };

  const handleExport = () => {
    const headers = ['Customer', 'Enquiries', 'Quotations', 'Converted', 'Conv %', 'Price Matched', 'Match→Conv %', 'Total Quoted', 'Won Value', 'Last Quotation', 'Top Win Reason', 'Top Loss Reason'];
    const rows = filtered.map(c => [
      c.customerName, c.enquiryCount, c.quotationCount, c.convertedCount, c.conversionRate.toFixed(1),
      c.priceMatchedCount, c.matchedConversionRate.toFixed(1),
      Math.round(c.totalQuotedValue), Math.round(c.totalWonValue),
      c.lastQuotationDate ? new Date(c.lastQuotationDate).toLocaleDateString('en-IN') : '—',
      c.topWinReason, c.topLossReason,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-quotation-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </TableHead>
  );

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Customer Quotation Journey</CardTitle>
          <CardDescription>
            {staffFilter ? `Filtered by: ${staffFilterName}` : 'Enquiry frequency, conversion rates & reasons per customer'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48 h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <SortHeader label="Enquiries" field="enquiryCount" />
              <SortHeader label="Quotations" field="quotationCount" />
              <SortHeader label="Converted" field="convertedCount" />
              <SortHeader label="Conv %" field="conversionRate" />
              <SortHeader label="Price Matched" field="priceMatchedCount" />
              <SortHeader label="Match→Conv %" field="matchedConversionRate" />
              <SortHeader label="Quoted Value" field="totalQuotedValue" />
              <SortHeader label="Won Value" field="totalWonValue" />
              <TableHead>Last Quotation</TableHead>
              <TableHead>Win Reason</TableHead>
              <TableHead>Loss Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
            ) : paginatedData.map(c => (
              <TableRow key={c.customerId} className="cursor-pointer hover:bg-muted/50" onClick={() => setDrilldown({ customerId: c.customerId, customerName: c.customerName })}>
                <TableCell className="font-medium max-w-[200px] truncate">{c.customerName}</TableCell>
                <TableCell>{c.enquiryCount}</TableCell>
                <TableCell>{c.quotationCount}</TableCell>
                <TableCell>{c.convertedCount}</TableCell>
                <TableCell>{c.conversionRate.toFixed(1)}%</TableCell>
                <TableCell>{c.priceMatchedCount}</TableCell>
                <TableCell>{c.matchedConversionRate.toFixed(1)}%</TableCell>
                <TableCell>{formatCurrency(c.totalQuotedValue)}</TableCell>
                <TableCell>{formatCurrency(c.totalWonValue)}</TableCell>
                <TableCell className="text-xs">{c.lastQuotationDate ? new Date(c.lastQuotationDate).toLocaleDateString('en-IN') : '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.topWinReason}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.topLossReason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls
          currentPage={currentPage}
          totalCount={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </CardContent>
    </Card>

    {drilldown && (
      <CustomerDrilldownDialog
        open={!!drilldown}
        onOpenChange={(open) => { if (!open) setDrilldown(null); }}
        customerId={drilldown.customerId}
        customerName={drilldown.customerName}
        dateRange={dateRange}
      />
    )}
    </>
  );
}
