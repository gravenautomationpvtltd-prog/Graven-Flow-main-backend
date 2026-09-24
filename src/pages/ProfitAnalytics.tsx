import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfitAnalytics } from "@/hooks/useProfitAnalytics";
import { ProfitStatsCards } from "@/components/profit/ProfitStatsCards";
import { ProductMarginTable } from "@/components/profit/ProductMarginTable";
import { MarginTrendChart } from "@/components/profit/MarginTrendChart";
import { CategoryBreakdownChart } from "@/components/profit/CategoryBreakdownChart";
import { useAuth } from "@/hooks/useAuth";
import { AccessDenied } from "@/components/ui/access-denied";

type DatePreset = 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'custom';

export default function ProfitAnalytics() {
  const { isAdmin } = useAuth();
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  if (!isAdmin) {
    return <AccessDenied message="Profit Analytics is only available to executives (COO/CEO)." />;
  }

  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case 'this_month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'last_30_days':
        return { from: subDays(now, 30), to: now };
      case 'last_90_days':
        return { from: subDays(now, 90), to: now };
      case 'this_year':
        return { from: new Date(now.getFullYear(), 0, 1), to: now };
      case 'custom':
        return { from: customFrom || null, to: customTo || null };
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  };

  const dateRange = getDateRange();
  const { data, isLoading } = useProfitAnalytics(dateRange);

  const exportToCSV = () => {
    if (!data?.productMargins) return;
    
    const headers = ['Product', 'HSN', 'Category', 'Selling Rate', 'Purchase Price', 'Margin ₹', 'Margin %', 'Qty Sold', 'Total Profit'];
    const rows = data.productMargins.map(p => [
      p.productName,
      p.hsnCode || '',
      p.category || '',
      p.sellingRate,
      p.purchasePrice,
      p.marginAmount,
      p.marginPercent.toFixed(2),
      p.quantitySold,
      p.totalProfit,
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-margins-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Profit Analytics
          </h1>
          <p className="text-muted-foreground">
            Track product margins and profitability across categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[180px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {customFrom ? format(customFrom, 'MMM d, yyyy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {customTo ? format(customTo, 'MMM d, yyyy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Button variant="outline" onClick={exportToCSV} disabled={!data?.productMargins?.length}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <ProfitStatsCards stats={data?.stats} isLoading={isLoading} />

      {/* Tabs for different views */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">By Product</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <ProductMarginTable 
            products={data?.productMargins || []} 
            isLoading={isLoading} 
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoryBreakdownChart 
            data={data?.categoryMargins || []} 
            isLoading={isLoading} 
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <MarginTrendChart 
            data={data?.monthlyMargins || []} 
            isLoading={isLoading} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
