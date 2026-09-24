import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmployeeAttendance, DateRangeParam } from '@/hooks/useEmployeeStats';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const statusColors: Record<string, string> = {
  present: 'bg-green-500/10 text-green-500',
  late: 'bg-yellow-500/10 text-yellow-600',
  absent: 'bg-red-500/10 text-red-500',
  leave: 'bg-blue-500/10 text-blue-500',
  half_day: 'bg-orange-500/10 text-orange-500',
};

interface EmployeeAttendanceTabProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeAttendanceTab({ employeeId, dateRange }: EmployeeAttendanceTabProps) {
  const { data: attendance, isLoading } = useEmployeeAttendance(employeeId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const periodLabel = dateRange?.from ? 'Selected period' : 'Last 60 days';

  const stats = {
    present: attendance?.filter(a => a.status === 'present').length || 0,
    late: attendance?.filter(a => a.status === 'late' || a.is_late).length || 0,
    absent: attendance?.filter(a => a.status === 'absent').length || 0,
    totalHours: attendance?.reduce((sum, a) => sum + (a.total_hours_worked || 0), 0) || 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Days</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
          <CardDescription>Recent attendance records for this employee</CardDescription>
        </CardHeader>
        <CardContent>
          {!attendance?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No attendance records found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours Worked</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Office</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), 'EEE, MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[record.status || 'present'] || ''}>
                          {record.status || 'present'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.check_in_time ? format(new Date(record.check_in_time), 'h:mm a') : '—'}
                      </TableCell>
                      <TableCell>
                        {record.check_out_time ? format(new Date(record.check_out_time), 'h:mm a') : '—'}
                      </TableCell>
                      <TableCell>
                        {record.total_hours_worked ? `${Number(record.total_hours_worked).toFixed(1)} hrs` : '—'}
                      </TableCell>
                      <TableCell>
                        {record.is_late ? (
                          <Badge variant="outline" className="text-yellow-600">
                            {record.late_minutes} min
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.office?.name || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
