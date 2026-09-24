import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWinLossAnalytics, ReasonBreakdown } from '@/hooks/useWinLossAnalytics';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Trophy, XCircle, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const WIN_COLORS = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16', '#a3e635'];
const LOSS_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a', '#f87171'];

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
};

interface ReasonPieChartProps {
  data: ReasonBreakdown[];
  colors: string[];
  title: string;
  type: 'won' | 'lost';
}

function ReasonPieChart({ data, colors, title, type }: ReasonPieChartProps) {
  const Icon = type === 'won' ? Trophy : XCircle;
  const iconColor = type === 'won' ? 'text-green-500' : 'text-red-500';
  const borderColor = type === 'won' ? 'border-green-500/20' : 'border-red-500/20';

  if (data.length === 0) {
    return (
      <Card className={borderColor}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item, idx) => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage,
    totalValue: item.totalValue,
    fill: colors[idx % colors.length],
  }));

  return (
    <Card className={borderColor}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>
          {data.reduce((sum, d) => sum + d.count, 0)} deals analyzed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="font-medium">{data.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {data.value} deals ({data.percentage.toFixed(1)}%)
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Value: {formatCurrency(data.totalValue)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Win/Loss Trends Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No trend data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    won: { label: 'Won', color: 'hsl(142, 76%, 36%)' },
    lost: { label: 'Lost', color: 'hsl(0, 84%, 60%)' },
    winRate: { label: 'Win Rate', color: 'hsl(221, 83%, 53%)' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Win/Loss Trends Over Time
        </CardTitle>
        <CardDescription>Monthly breakdown of deal outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                className="text-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === 'winRate') {
                        return [`${Number(value).toFixed(1)}%`, 'Win Rate'];
                      }
                      return [value, name === 'won' ? 'Won' : 'Lost'];
                    }}
                  />
                }
              />
              <Bar yAxisId="left" dataKey="won" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="lost" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="winRate" 
                stroke="hsl(221, 83%, 53%)" 
                strokeWidth={2}
                dot={{ fill: 'hsl(221, 83%, 53%)', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function TopReasonsTable({ winReasons, lossReasons }: { winReasons: ReasonBreakdown[]; lossReasons: ReasonBreakdown[] }) {
  const topWin = winReasons.slice(0, 5);
  const topLoss = lossReasons.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Top Reasons Breakdown
        </CardTitle>
        <CardDescription>Most common reasons for winning and losing deals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Win Reasons */}
          <div>
            <h4 className="font-medium text-green-500 mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Top Win Reasons
            </h4>
            <div className="space-y-2">
              {topWin.length === 0 ? (
                <p className="text-sm text-muted-foreground">No win data</p>
              ) : (
                topWin.map((reason, idx) => (
                  <motion.div
                    key={reason.reason}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-500 w-5">#{idx + 1}</span>
                      <span className="text-sm">{reason.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {reason.count} deals
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {reason.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Loss Reasons */}
          <div>
            <h4 className="font-medium text-red-500 mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Top Loss Reasons
            </h4>
            <div className="space-y-2">
              {topLoss.length === 0 ? (
                <p className="text-sm text-muted-foreground">No loss data</p>
              ) : (
                topLoss.map((reason, idx) => (
                  <motion.div
                    key={reason.reason}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-500 w-5">#{idx + 1}</span>
                      <span className="text-sm">{reason.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {reason.count} deals
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {reason.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WinLossAnalyticsDashboard() {
  const [monthsBack, setMonthsBack] = useState<number>(6);
  const { data, isLoading } = useWinLossAnalytics(monthsBack);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[180px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[380px]" />
          <Skeleton className="h-[380px]" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end">
        <Select value={monthsBack.toString()} onValueChange={(v) => setMonthsBack(parseInt(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Won</p>
                  <p className="text-2xl font-bold text-green-500">{data?.totalWon || 0}</p>
                </div>
                <Trophy className="h-8 w-8 text-green-500/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-red-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Lost</p>
                  <p className="text-2xl font-bold text-red-500">{data?.totalLost || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold text-primary">
                    {(data?.overallWinRate || 0).toFixed(1)}%
                  </p>
                </div>
                <Target className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-yellow-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Value Won</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {formatCurrency(data?.totalWonValue || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500/20" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ReasonPieChart
            data={data?.winReasons || []}
            colors={WIN_COLORS}
            title="Win Reasons Distribution"
            type="won"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ReasonPieChart
            data={data?.lossReasons || []}
            colors={LOSS_COLORS}
            title="Loss Reasons Distribution"
            type="lost"
          />
        </motion.div>
      </div>

      {/* Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <TrendChart data={data?.monthlyTrends || []} />
      </motion.div>

      {/* Top Reasons Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <TopReasonsTable
          winReasons={data?.winReasons || []}
          lossReasons={data?.lossReasons || []}
        />
      </motion.div>
    </div>
  );
}
