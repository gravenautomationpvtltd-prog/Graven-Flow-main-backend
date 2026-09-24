import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, ArrowUpDown } from 'lucide-react';
import type { StaffBreakdown } from '@/hooks/useQuotationAnalytics';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');
import { StaffDrilldownDialog } from './StaffDrilldownDialog';

interface Props {
  data: StaffBreakdown[];
  selectedStaffId: string | null;
  onSelectStaff: (id: string | null) => void;
  dateRange: { from?: Date; to?: Date };
}

type SortKey = 'quotationCount' | 'totalValue' | 'convertedCount' | 'conversionRate' | 'avgDaysToConvert' | 'priceMatchedCount' | 'matchedConversionRate';

export function StaffQuotationTable({ data, selectedStaffId, onSelectStaff, dateRange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [drilldown, setDrilldown] = useState<{ staffId: string; staffName: string } | null>(null);

  const sorted = [...data].sort((a, b) => sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const handleExport = () => {
    const headers = ['Sales Person', 'Quotations', 'Value', 'Converted', 'Conversion %', 'Avg Days', 'Price Matched', 'Match→Conv %', 'Top Loss Reason'];
    const rows = sorted.map(s => [s.staffName, s.quotationCount, Math.round(s.totalValue), s.convertedCount, s.conversionRate.toFixed(1), s.avgDaysToConvert.toFixed(1), s.priceMatchedCount, s.matchedConversionRate.toFixed(1), s.topLossReason]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-quotation-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </TableHead>
  );

  const handleRowClick = (staffId: string, staffName: string) => {
    // Toggle staff filter on single click
    onSelectStaff(selectedStaffId === staffId ? null : staffId);
  };

  const handleDrilldown = (e: React.MouseEvent, staffId: string, staffName: string) => {
    e.stopPropagation();
    setDrilldown({ staffId, staffName });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Staff Quotation Performance</CardTitle>
          <CardDescription>Click a row to filter customers • Double-click for detailed view</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> CSV</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sales Person</TableHead>
              <SortHeader label="Quotations" field="quotationCount" />
              <SortHeader label="Value" field="totalValue" />
              <SortHeader label="Converted" field="convertedCount" />
              <SortHeader label="Conv %" field="conversionRate" />
              <SortHeader label="Avg Days" field="avgDaysToConvert" />
              <SortHeader label="Price Matched" field="priceMatchedCount" />
              <SortHeader label="Match→Conv %" field="matchedConversionRate" />
              <TableHead>Top Loss Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No staff data for this filter</TableCell></TableRow>
            ) : sorted.map(s => (
              <TableRow
                key={s.staffId}
                className={`cursor-pointer hover:bg-muted/50 ${selectedStaffId === s.staffId ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                onClick={() => handleRowClick(s.staffId, s.staffName)}
                onDoubleClick={(e) => handleDrilldown(e, s.staffId, s.staffName)}
              >
                <TableCell className="font-medium">{s.staffName}</TableCell>
                <TableCell>{s.quotationCount}</TableCell>
                <TableCell>{formatCurrency(s.totalValue)}</TableCell>
                <TableCell>{s.convertedCount}</TableCell>
                <TableCell>{s.conversionRate.toFixed(1)}%</TableCell>
                <TableCell>{s.avgDaysToConvert.toFixed(1)}</TableCell>
                <TableCell>{s.priceMatchedCount}</TableCell>
                <TableCell>{s.matchedConversionRate.toFixed(1)}%</TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.topLossReason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {drilldown && (
        <StaffDrilldownDialog
          open={!!drilldown}
          onOpenChange={(open) => { if (!open) setDrilldown(null); }}
          staffId={drilldown.staffId}
          staffName={drilldown.staffName}
          dateRange={dateRange}
        />
      )}
    </Card>
  );
}
