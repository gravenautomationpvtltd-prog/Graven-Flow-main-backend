import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeeStats } from '@/hooks/useEmployeeStats';
import { 
  Target, 
  Users, 
  ShoppingCart, 
  IndianRupee, 
  CheckSquare, 
  AlertTriangle,
  TrendingUp,
  FileText
} from 'lucide-react';

interface EmployeePerformanceTabProps {
  stats: EmployeeStats | undefined;
  isLoading: boolean;
}

export function EmployeePerformanceTab({ stats, isLoading }: EmployeePerformanceTabProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Unable to load performance data</p>
      </div>
    );
  }

  const taskCompletionRate = stats.taskCount > 0 
    ? (stats.completedTaskCount / stats.taskCount) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leadCount}</div>
            <p className="text-xs text-muted-foreground">Assigned leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerCount}</div>
            <p className="text-xs text-muted-foreground">Assigned customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orderCount}</div>
            <p className="text-xs text-muted-foreground">From their leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total revenue generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotations</CardTitle>
            <FileText className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quotationCount}</div>
            <p className="text-xs text-muted-foreground">Created quotations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTaskCount}/{stats.taskCount}</div>
            <p className="text-xs text-muted-foreground">Completed / Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.escalationCount}</div>
            <p className="text-xs text-muted-foreground">Total escalations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate</CardTitle>
            <CardDescription>Leads converted to won deals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">
                Target: 25%
              </span>
            </div>
            <Progress 
              value={stats.conversionRate} 
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">
              {stats.conversionRate >= 25 ? (
                <span className="text-green-500">Above target</span>
              ) : (
                <span className="text-yellow-500">Below target</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Completion Rate</CardTitle>
            <CardDescription>Completed vs assigned tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{taskCompletionRate.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">
                Target: 80%
              </span>
            </div>
            <Progress 
              value={taskCompletionRate} 
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">
              {taskCompletionRate >= 80 ? (
                <span className="text-green-500">Above target</span>
              ) : (
                <span className="text-yellow-500">Below target</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate</CardTitle>
            <CardDescription>Present days in last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.attendanceRate.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">
                Target: 95%
              </span>
            </div>
            <Progress 
              value={stats.attendanceRate} 
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">
              {stats.attendanceRate >= 95 ? (
                <span className="text-green-500">Excellent attendance</span>
              ) : stats.attendanceRate >= 80 ? (
                <span className="text-yellow-500">Good attendance</span>
              ) : (
                <span className="text-red-500">Needs improvement</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escalation Score</CardTitle>
            <CardDescription>Lower is better</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.escalationCount}</span>
              <span className="text-sm text-muted-foreground">
                Target: 0
              </span>
            </div>
            <Progress 
              value={Math.max(0, 100 - stats.escalationCount * 10)} 
              className="h-2"
            />
            <p className="text-sm text-muted-foreground">
              {stats.escalationCount === 0 ? (
                <span className="text-green-500">No escalations - Excellent!</span>
              ) : stats.escalationCount <= 3 ? (
                <span className="text-yellow-500">Few escalations</span>
              ) : (
                <span className="text-red-500">High escalation count</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
