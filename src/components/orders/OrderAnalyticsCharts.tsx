import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  useOrderTrends,
  usePaymentDistribution,
  useFulfillmentMetrics,
  useTopSalesReps,
  DateRange,
} from '@/hooks/useOrderAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const PAYMENT_COLORS = {
  Received: 'hsl(142, 76%, 36%)',
  Partial: 'hsl(45, 93%, 47%)',
  Pending: 'hsl(0, 84%, 60%)',
};

interface OrderAnalyticsChartsProps {
  userId?: string;
  dateRange?: DateRange;
}

export function OrderAnalyticsCharts({ userId, dateRange }: OrderAnalyticsChartsProps) {
  const { isManager, isAdmin } = useAuth();
  const { data: trends, isLoading: trendsLoading } = useOrderTrends(userId, dateRange);
  const { data: paymentDistribution, isLoading: paymentLoading } = usePaymentDistribution(userId, dateRange);
  const { data: fulfillmentMetrics, isLoading: fulfillmentLoading } = useFulfillmentMetrics(userId, dateRange);
  const { data: topReps, isLoading: repsLoading } = useTopSalesReps(dateRange);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Order Trends */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Order Trends</CardTitle>
          <CardDescription>Order volume and value over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'value' ? `₹${value.toLocaleString()}` : value,
                    name === 'value' ? 'Value' : 'Orders'
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--primary))"
                  fill="url(#orderGradient)"
                  strokeWidth={2}
                />
                <Bar yAxisId="right" dataKey="value" fill="hsl(var(--chart-2))" opacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
          <CardDescription>Distribution by payment collection status</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={paymentDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {paymentDistribution?.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PAYMENT_COLORS[entry.status as keyof typeof PAYMENT_COLORS] || COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string, props) => [
                    `${value} orders (₹${props.payload.value.toLocaleString()})`,
                    props.payload.status
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Fulfillment Status */}
      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Status</CardTitle>
          <CardDescription>Orders by fulfillment stage</CardDescription>
        </CardHeader>
        <CardContent>
          {fulfillmentLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={fulfillmentMetrics} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="status" width={120} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Sales Reps - Only for managers */}
      {(isManager || isAdmin) && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Top Sales Representatives</CardTitle>
            <CardDescription>Ranked by total order value in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {repsLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topReps && topReps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Avg Order Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReps.map((rep, index) => (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell>{rep.name}</TableCell>
                      <TableCell className="text-right">{rep.orders}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{rep.value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₹{Math.round(rep.value / rep.orders).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No sales data available for selected period
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
