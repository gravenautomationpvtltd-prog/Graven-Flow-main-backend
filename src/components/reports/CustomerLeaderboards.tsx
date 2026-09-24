import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, DollarSign, ShoppingCart, BarChart3 } from 'lucide-react';
import { useCustomerLeaderboards } from '@/hooks/useLeaderboards';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

interface CustomerLeaderboardsProps {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  limit: number;
}

export function CustomerLeaderboards({ dateRange, limit }: CustomerLeaderboardsProps) {
  const { data, isLoading } = useCustomerLeaderboards(dateRange, limit);
  const [activeTab, setActiveTab] = useState('revenue');

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
    a.download = `customers-${type}-top-${limit || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    await logActivity({
      action: 'export',
      entityType: 'report',
      entityName: `Customers ${type} Leaderboard`,
      metadata: { format: 'csv', count: exportData.length },
    });
    toast.success(`Exported ${exportData.length} customers`);
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
        <CardTitle>Customer Rankings</CardTitle>
        <CardDescription>
          Analyze customer performance by revenue, order count, and conversion rate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="revenue" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                By Revenue
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />
                By Order Count
              </TabsTrigger>
              <TabsTrigger value="conversion" className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                By Conversion
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const exportMap: Record<string, any[]> = {
                  revenue: data?.byRevenue || [],
                  orders: data?.byOrderCount || [],
                  conversion: data?.byConversion || [],
                };
                handleExport(activeTab, exportMap[activeTab]);
              }}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>

          <TabsContent value="revenue" className="mt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byRevenue?.length ? (
                    data.byRevenue.map((item, index) => (
                      <TableRow key={item.customer_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.company_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.industry || '-'}</TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.avg_order_value)}</TableCell>
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byOrderCount?.length ? (
                    data.byOrderCount.map((item, index) => (
                      <TableRow key={item.customer_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.company_name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.industry || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{item.order_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.avg_order_value)}</TableCell>
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
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byConversion?.length ? (
                    data.byConversion.map((item, index) => (
                      <TableRow key={item.customer_id}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.company_name}</TableCell>
                        <TableCell className="text-right">{item.quote_count}</TableCell>
                        <TableCell className="text-right">{item.order_count}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={item.conversion_rate >= 50 ? 'text-green-600' : item.conversion_rate >= 25 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPercent(item.conversion_rate)}
                          </span>
                        </TableCell>
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
