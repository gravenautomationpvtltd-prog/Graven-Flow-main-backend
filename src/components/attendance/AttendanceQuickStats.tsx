import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAttendanceStats } from '@/hooks/useAttendanceStats';
import { 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceQuickStatsProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
}

type DialogType = 'attendance-rate' | 'avg-hours' | 'on-time' | 'late' | null;

export function AttendanceQuickStats({ userId, selectedMonth, selectedYear }: AttendanceQuickStatsProps) {
  const { data: stats, isLoading } = useAttendanceStats(userId, selectedMonth, selectedYear);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const avgHoursPerDay = stats?.totalHours && stats?.presentDays 
    ? (stats.totalHours / stats.presentDays).toFixed(1) 
    : '0';

  const onTimeDays = stats?.presentDays ? stats.presentDays - (stats?.lateDays || 0) : 0;

  const statCards = [
    {
      id: 'attendance-rate' as DialogType,
      title: 'Attendance Rate',
      value: `${stats?.attendanceRate || 0}%`,
      subtitle: `${stats?.presentDays || 0} of ${stats?.workingDays || 0} days`,
      icon: Target,
      trend: (stats?.attendanceRate || 0) >= 90 ? 'up' : (stats?.attendanceRate || 0) >= 75 ? 'neutral' : 'down',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      dialogContent: {
        title: 'Attendance Rate Breakdown',
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-primary">{stats?.presentDays || 0}</div>
                <div className="text-sm text-muted-foreground">Present Days</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-muted-foreground">{stats?.workingDays || 0}</div>
                <div className="text-sm text-muted-foreground">Working Days</div>
              </div>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{stats?.attendanceRate || 0}%</div>
                <div className="text-sm text-muted-foreground mt-1">Overall Attendance Rate</div>
              </div>
            </div>
          </div>
        )
      }
    },
    {
      id: 'avg-hours' as DialogType,
      title: 'Avg. Hours/Day',
      value: `${avgHoursPerDay}h`,
      subtitle: 'Target: 9h',
      icon: Clock,
      trend: parseFloat(avgHoursPerDay) >= 9 ? 'up' : parseFloat(avgHoursPerDay) >= 7 ? 'neutral' : 'down',
      iconBg: 'bg-blue-100 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      dialogContent: {
        title: 'Working Hours Details',
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats?.totalHours?.toFixed(1) || 0}h</div>
                <div className="text-sm text-muted-foreground">Total Hours</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{avgHoursPerDay}h</div>
                <div className="text-sm text-muted-foreground">Average/Day</div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Progress to 9h target</span>
                <span className="text-sm font-medium">{Math.min(100, Math.round((parseFloat(avgHoursPerDay) / 9) * 100))}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (parseFloat(avgHoursPerDay) / 9) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )
      }
    },
    {
      id: 'on-time' as DialogType,
      title: 'On-Time Arrival',
      value: `${onTimeDays}`,
      subtitle: 'Days on time',
      icon: CheckCircle2,
      trend: 'up',
      iconBg: 'bg-green-100 dark:bg-green-950/50',
      iconColor: 'text-green-600 dark:text-green-400',
      dialogContent: {
        title: 'On-Time Arrivals',
        content: (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <div className="text-4xl font-bold text-green-600 dark:text-green-400">{onTimeDays}</div>
              <div className="text-sm text-muted-foreground mt-1">Days with On-Time Arrival</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats?.onTimeRate || 0}%</div>
                <div className="text-sm text-muted-foreground">On-Time Rate</div>
              </div>
            </div>
          </div>
        )
      }
    },
    {
      id: 'late' as DialogType,
      title: 'Late Arrivals',
      value: `${stats?.lateDays || 0}`,
      subtitle: '> 15 mins late',
      icon: AlertTriangle,
      trend: stats?.lateDays && stats.lateDays > 3 ? 'down' : 'neutral',
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      dialogContent: {
        title: 'Late Arrivals',
        content: (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
              <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">{stats?.lateDays || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Days with Late Arrival</div>
            </div>
            {(stats?.lateDays || 0) > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Late arrivals are recorded when check-in is more than 15 minutes after office opening time.
                </p>
              </div>
            )}
          </div>
        )
      }
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="group hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer"
            onClick={() => setActiveDialog(stat.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </span>
                <div className={cn("p-2 rounded-lg", stat.iconBg)}>
                  <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                </div>
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">
                  {stat.value}
                </span>
                {stat.trend === 'up' && (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                )}
                {stat.trend === 'down' && (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              
              <p className={cn(
                "text-xs mt-1",
                stat.trend === 'up' ? 'text-green-600 dark:text-green-400' :
                stat.trend === 'down' ? 'text-red-600 dark:text-red-400' :
                'text-muted-foreground'
              )}>
                {stat.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Dialogs */}
      {statCards.map((stat) => (
        <Dialog 
          key={stat.id} 
          open={activeDialog === stat.id} 
          onOpenChange={(open) => !open && setActiveDialog(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
                {stat.dialogContent.title}
              </DialogTitle>
            </DialogHeader>
            {stat.dialogContent.content}
          </DialogContent>
        </Dialog>
      ))}
    </>
  );
}
