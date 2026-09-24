import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRoundedINR } from '@/lib/currency-utils';
import { 
  Trophy, 
  XCircle, 
  TrendingUp, 
  IndianRupee,
  Target
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { EmployeeDetailedStats } from '@/hooks/useEmployeeDetailedStats';

interface EmployeeWinLossAnalyticsProps {
  stats: EmployeeDetailedStats | undefined;
  isLoading: boolean;
  onNavigateToDeals?: (filter: 'all' | 'won' | 'lost') => void;
}

const WIN_COLORS = ['#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7'];
const LOSS_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

export function EmployeeWinLossAnalytics({ stats, isLoading, onNavigateToDeals }: EmployeeWinLossAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No win/loss data available
      </div>
    );
  }

  const winPieData = stats.winReasons.map(r => ({
    name: r.label,
    value: r.count,
    amount: r.totalValue,
  }));

  const lossPieData = stats.lossReasons.map(r => ({
    name: r.label,
    value: r.count,
    amount: r.totalValue,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards - Interactive */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all"
                onClick={() => onNavigateToDeals?.('won')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Won Deals</CardTitle>
                  <Trophy className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl lg:text-2xl font-bold text-green-600">{stats.wonCount}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Click to view won deals</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="cursor-pointer hover:border-red-500 hover:shadow-md transition-all"
                onClick={() => onNavigateToDeals?.('lost')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Lost Deals</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl lg:text-2xl font-bold text-red-600">{stats.lostCount}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>Click to view lost deals</TooltipContent>
          </Tooltip>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Win Rate</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl lg:text-2xl font-bold">{Math.round(stats.winRate)}%</div>
            </CardContent>
          </Card>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all"
                onClick={() => onNavigateToDeals?.('won')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Won Revenue</CardTitle>
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg lg:text-xl font-bold text-emerald-600 truncate">
                    {formatRoundedINR(stats.wonRevenue)}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Exact: ₹{stats.wonRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="cursor-pointer hover:border-orange-500 hover:shadow-md transition-all"
                onClick={() => onNavigateToDeals?.('lost')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Lost Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg lg:text-xl font-bold text-orange-600 truncate">
                    {formatRoundedINR(stats.lostValue)}
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Exact: ₹{stats.lostValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Reason Pie Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-500" />
              Win Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {winPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={winPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {winPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={WIN_COLORS[index % WIN_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${value} deals (${formatRoundedINR(props.payload.amount)})`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No won deals yet
              </div>
            )}
            <div className="mt-4 space-y-2">
              {stats.winReasons.slice(0, 3).map((reason, i) => (
                <div key={reason.reason} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: WIN_COLORS[i] }}
                    />
                    <span>{reason.label}</span>
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    {reason.count} ({Math.round(reason.percentage)}%)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Loss Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lossPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {lossPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={LOSS_COLORS[index % LOSS_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${value} deals (${formatRoundedINR(props.payload.amount)})`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No lost deals yet
              </div>
            )}
            <div className="mt-4 space-y-2">
              {stats.lossReasons.slice(0, 3).map((reason, i) => (
                <div key={reason.reason} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: LOSS_COLORS[i] }}
                    />
                    <span>{reason.label}</span>
                  </div>
                  <Badge variant="outline" className="text-red-600">
                    {reason.count} ({Math.round(reason.percentage)}%)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Win/Loss Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="won" name="Won" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                  className="text-muted-foreground"
                />
                <RechartsTooltip 
                  formatter={(value: number) => [`${Math.round(value)}%`, 'Win Rate']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="winRate" 
                  name="Win Rate"
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
