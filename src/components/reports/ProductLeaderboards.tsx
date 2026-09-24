import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileText, TrendingUp, BarChart3, DollarSign } from 'lucide-react';
import { useProductLeaderboards } from '@/hooks/useLeaderboards';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

interface ProductLeaderboardsProps {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  limit: number;
}

export function ProductLeaderboards({ dateRange, limit }: ProductLeaderboardsProps) {
  const { data, isLoading } = useProductLeaderboards(dateRange, limit);
  const [activeTab, setActiveTab] = useState('quotes');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const handleExport = async (type: string, exportData: any[]) => {
    if (!exportData?.length) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(h => {
          const val = row[h];
          if (typeof val === 'number') return val;
          return `"${String(val || '').replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${type}-top-${limit || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    await logActivity({
      action: 'export',
      entityType: 'report',
      entityName: `Products ${type} Leaderboard`,
      metadata: { format: 'csv', count: exportData.length },
    });
    toast.success(`Exported ${exportData.length} products`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
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
        <CardTitle>Product Rankings</CardTitle>
        <CardDescription>
          Analyze product performance by quotes, orders, conversion, and profit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="quotes" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                By Quotes
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                By Orders
              </TabsTrigger>
              <TabsTrigger value="conversion" className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                By Conversion
              </TabsTrigger>
              <TabsTrigger value="profit" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                By Profit
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const exportMap: Record<string, any[]> = {
                  quotes: data?.byQuotes || [],
                  orders: data?.byOrders || [],
                  conversion: data?.byConversion || [],
                  profit: data?.byProfit || [],
                };
                handleExport(activeTab, exportMap[activeTab]);
              }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>

          <TabsContent value="quotes" className="mt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Quote Value</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byQuotes?.length ? (
                    data.byQuotes.map((item, index) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{item.quote_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.quote_value)}</TableCell>
                        <TableCell className="text-right">{item.customer_count}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byOrders?.length ? (
                    data.byOrders.map((item, index) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell className="text-right">{item.units_sold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="conversion" className="mt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byConversion?.length ? (
                    data.byConversion.map((item, index) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{item.quote_count}</TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={item.conversion_rate >= 50 ? 'text-green-600' : item.conversion_rate >= 25 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPercent(item.conversion_rate)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="mt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byProfit?.length ? (
                    data.byProfit.map((item, index) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={item.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(item.profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.margin_pct >= 30 ? 'text-green-600' : item.margin_pct >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPercent(item.margin_pct)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No profit data available (requires purchase prices)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
