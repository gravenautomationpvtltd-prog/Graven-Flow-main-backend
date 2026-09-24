import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Calendar, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useAttendanceRecords } from '@/hooks/useAttendance';
import { cn } from '@/lib/utils';

interface AttendanceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  selectedMonth: number;
  selectedYear: number;
}

export function AttendanceReportDialog({
  open,
  onOpenChange,
  userId,
  selectedMonth,
  selectedYear,
}: AttendanceReportDialogProps) {
  const monthDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const { data: records, isLoading } = useAttendanceRecords({
    userId,
    startDate: monthStart,
    endDate: monthEnd,
  });

  // Calculate summary statistics
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workingDays = allDays.filter(day => !isWeekend(day)).length;
  
  const sortedRecords = records?.slice().sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ) || [];

  const presentDays = sortedRecords.filter(r => r.status === 'present').length;
  const lateDays = sortedRecords.filter(r => r.is_late).length;
  const onTimeDays = presentDays - lateDays;
  const absentDays = workingDays - presentDays;
  const totalHours = sortedRecords.reduce((sum, r) => sum + (Number(r.total_hours_worked) || 0), 0);
  const avgHours = presentDays > 0 ? (totalHours / presentDays).toFixed(1) : '0';

  const getStatusBadge = (record: typeof sortedRecords[0] | undefined, date: Date) => {
    if (isWeekend(date)) {
      return <Badge variant="secondary" className="text-[10px]">Weekend</Badge>;
    }
    if (!record) {
      return <Badge variant="outline" className="text-[10px] text-muted-foreground">Absent</Badge>;
    }
    if (record.is_late) {
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] border-0">
          Late +{record.late_minutes}m
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] border-0">
        On Time
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Report - {format(monthDate, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{onTimeDays}</div>
                <div className="text-xs text-green-600 dark:text-green-400">On Time</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{lateDays}</div>
                <div className="text-xs text-amber-600 dark:text-amber-400">Late</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{absentDays}</div>
                <div className="text-xs text-red-600 dark:text-red-400">Absent</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{avgHours}h</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">Avg/Day</div>
              </div>
            </div>

            {/* Attendance Table */}
            <ScrollArea className="h-[400px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Check In</th>
                    <th className="text-left p-3 font-medium">Check Out</th>
                    <th className="text-left p-3 font-medium">Hours</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allDays.map((day) => {
                    const record = sortedRecords.find(r => 
                      new Date(r.date).toDateString() === day.toDateString()
                    );
                    const isWeekendDay = isWeekend(day);
                    
                    return (
                      <tr 
                        key={day.toISOString()} 
                        className={cn(
                          "border-b last:border-0",
                          isWeekendDay && "bg-muted/30"
                        )}
                      >
                        <td className="p-3">
                          <div className="font-medium">{format(day, 'EEE, d MMM')}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {record?.check_in_time 
                            ? format(new Date(record.check_in_time), 'hh:mm a')
                            : isWeekendDay ? '-' : '-'
                          }
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {record?.check_out_time 
                            ? format(new Date(record.check_out_time), 'hh:mm a')
                            : record?.check_in_time ? 'Active' : '-'
                          }
                        </td>
                        <td className="p-3 font-medium">
                          {record?.total_hours_worked 
                            ? `${record.total_hours_worked.toFixed(1)}h`
                            : '-'
                          }
                        </td>
                        <td className="p-3">
                          {getStatusBadge(record, day)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>

            {/* Footer Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <div>
                Total Working Days: <span className="font-medium text-foreground">{workingDays}</span>
              </div>
              <div>
                Total Hours: <span className="font-medium text-foreground">{totalHours.toFixed(1)}h</span>
              </div>
              <div>
                Attendance: <span className="font-medium text-foreground">{workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
