import { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { useMonthlyAttendanceReport } from '@/hooks/useAttendance';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';

export function AttendanceReports() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [officeFilter, setOfficeFilter] = useState<string>('all');

  const { data: report, isLoading } = useMonthlyAttendanceReport(
    selectedMonth,
    officeFilter !== 'all' ? officeFilter : undefined
  );

  const { data: offices } = useOfficesManagement();

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: date.toISOString(),
      label: format(date, 'MMMM yyyy'),
    };
  });

  // Calculate summary stats
  const summaryStats = report?.reduce(
    (acc, user) => {
      acc.totalEmployees++;
      acc.totalPresentDays += user.presentDays;
      acc.totalLateDays += user.lateDays;
      acc.totalLeaveDays += user.leaveDays;
      acc.totalHoursWorked += user.totalHoursWorked;
      return acc;
    },
    {
      totalEmployees: 0,
      totalPresentDays: 0,
      totalLateDays: 0,
      totalLeaveDays: 0,
      totalHoursWorked: 0,
    }
  ) || {
    totalEmployees: 0,
    totalPresentDays: 0,
    totalLateDays: 0,
    totalLeaveDays: 0,
    totalHoursWorked: 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Month:</span>
          <Select 
            value={selectedMonth.toISOString()} 
            onValueChange={(v) => setSelectedMonth(new Date(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Office:</span>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Offices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {offices?.map((office) => (
                <SelectItem key={office.id} value={office.id}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{summaryStats.totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Present Days</p>
                <p className="text-2xl font-bold">{summaryStats.totalPresentDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Late Days</p>
                <p className="text-2xl font-bold">{summaryStats.totalLateDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{summaryStats.totalHoursWorked.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Attendance Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-center">Present Days</TableHead>
              <TableHead className="text-center">Late Days</TableHead>
              <TableHead className="text-center">Total Late (mins)</TableHead>
              <TableHead className="text-center">Early Departures</TableHead>
              <TableHead className="text-center">Leave Days</TableHead>
              <TableHead className="text-center">Total Hours</TableHead>
              <TableHead className="text-center">Avg Hours/Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No attendance data for this period
                </TableCell>
              </TableRow>
            ) : (
              report?.map((userStats) => (
                <TableRow key={userStats.user.id}>
                  <TableCell className="font-medium">
                    <div>
                      <p>{userStats.user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{userStats.user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{userStats.presentDays}</TableCell>
                  <TableCell className="text-center">
                    {userStats.lateDays > 0 ? (
                      <span className="text-destructive font-medium">{userStats.lateDays}</span>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {userStats.totalLateMinutes > 0 ? (
                      <span className="text-destructive">{userStats.totalLateMinutes}</span>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell className="text-center">{userStats.earlyDepartures}</TableCell>
                  <TableCell className="text-center">{userStats.leaveDays}</TableCell>
                  <TableCell className="text-center">{userStats.totalHoursWorked.toFixed(1)}</TableCell>
                  <TableCell className="text-center">
                    {userStats.presentDays > 0
                      ? (userStats.totalHoursWorked / userStats.presentDays).toFixed(1)
                      : '0'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
