import { useState } from 'react';
import { format, isToday, isWeekend, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, MapPin, Building2 } from 'lucide-react';
import { useAttendanceRecords } from '@/hooks/useAttendance';
import { cn } from '@/lib/utils';
import { AttendanceReportDialog } from './AttendanceReportDialog';

interface AttendanceHistoryProps {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
}

export function AttendanceHistory({ userId, selectedMonth, selectedYear }: AttendanceHistoryProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  
  const monthDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  
  const { data: records, isLoading } = useAttendanceRecords({
    userId,
    startDate: monthStart,
    endDate: monthEnd,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort records by date descending
  const sortedRecords = records?.slice().sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) || [];

  // Generate days for the month
  const getDaysWithStatus = () => {
    const days = [];
    const today = new Date();
    const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
    const lastDay = isCurrentMonth ? today.getDate() : monthEnd.getDate();
    
    for (let i = lastDay; i >= 1; i--) {
      const date = new Date(selectedYear, selectedMonth, i);
      const record = sortedRecords.find(r => 
        new Date(r.date).toDateString() === date.toDateString()
      );
      
      days.push({
        date,
        record,
        isWeekend: isWeekend(date),
        isToday: isToday(date)
      });
    }
    
    return days;
  };

  // Only show 5 days
  const days = getDaysWithStatus().slice(0, 5);

  const getStatusBadge = (day: typeof days[0]) => {
    if (day.isWeekend && !day.record) {
      return (
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
          Holiday
        </Badge>
      );
    }
    
    if (!day.record) {
      if (day.isToday) return null;
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">
          Absent
        </Badge>
      );
    }

    if (day.record.is_late) {
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-2 py-0.5 border-0">
          Late +{day.record.late_minutes}m
        </Badge>
      );
    }

    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-2 py-0.5 border-0">
        On Time
      </Badge>
    );
  };

  const getTimeRange = (day: typeof days[0]) => {
    if (day.isWeekend && !day.record) {
      return 'Weekly Off';
    }
    
    if (!day.record?.check_in_time) {
      return day.isToday ? 'Not checked in' : '-';
    }

    const checkIn = format(new Date(day.record.check_in_time), 'hh:mm a');
    const checkOut = day.record.check_out_time 
      ? format(new Date(day.record.check_out_time), 'hh:mm a')
      : 'Active';

    return `${checkIn} - ${checkOut}`;
  };

  const getProgressWidth = (hours: number | null) => {
    if (!hours) return 0;
    return Math.min((hours / 9) * 100, 100);
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Attendance History
            </CardTitle>
            <Button 
              variant="link" 
              size="sm" 
              className="text-primary h-auto p-0"
              onClick={() => setShowReportDialog(true)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              View Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-2">
          {days.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No attendance records for this period
            </div>
          ) : (
            days.map((day) => (
              <div 
                key={day.date.toISOString()}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-xl transition-colors",
                  day.isToday 
                    ? "bg-primary/5 border border-primary/20" 
                    : day.isWeekend && !day.record
                    ? "bg-muted/30"
                    : "hover:bg-muted/50"
                )}
              >
                {/* Date Box */}
                <div className={cn(
                  "flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 flex-shrink-0",
                  day.isToday 
                    ? "border-primary bg-primary/10" 
                    : day.isWeekend 
                    ? "border-muted-foreground/20 bg-muted/50"
                    : "border-border bg-card"
                )}>
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    day.isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {format(day.date, 'EEE')}
                  </span>
                  <span className={cn(
                    "text-xl font-bold -mt-0.5",
                    day.isToday ? "text-primary" : ""
                  )}>
                    {format(day.date, 'd')}
                  </span>
                </div>

                {/* Time & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      day.isWeekend && !day.record ? "text-muted-foreground" : ""
                    )}>
                      {getTimeRange(day)}
                    </span>
                    {getStatusBadge(day)}
                  </div>
                  
                  {/* Progress Bar */}
                  {day.record?.total_hours_worked || (day.isToday && day.record?.check_in_time) ? (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          day.isToday && !day.record?.check_out_time
                            ? "bg-gradient-to-r from-primary to-primary/60 animate-pulse"
                            : day.record?.total_hours_worked && day.record.total_hours_worked >= 9 
                            ? "bg-green-500" 
                            : "bg-primary"
                        )}
                        style={{ 
                          width: day.isToday && !day.record?.check_out_time
                            ? '70%'
                            : `${getProgressWidth(day.record?.total_hours_worked || 0)}%` 
                        }}
                      />
                    </div>
                  ) : day.isWeekend && !day.record ? (
                    <div className="h-2 bg-muted/50 rounded-full" />
                  ) : null}
                </div>

                {/* Hours & Location */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {day.record?.total_hours_worked && (
                    <span className="text-sm font-semibold tabular-nums">
                      {day.record.total_hours_worked.toFixed(1)}h
                    </span>
                  )}
                  {day.record && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs",
                      (day.record as any).attendance_type === 'field' 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-muted-foreground"
                    )}>
                      {(day.record as any).attendance_type === 'field' ? (
                        <>
                          <MapPin className="h-3 w-3" />
                          <span>Field</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="h-3 w-3" />
                          <span>Office</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AttendanceReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        userId={userId}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
    </>
  );
}
