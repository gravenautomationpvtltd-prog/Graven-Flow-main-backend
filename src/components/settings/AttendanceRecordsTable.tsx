import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, CheckCircle, XCircle, LogIn, LogOut } from 'lucide-react';
import { useAttendanceRecords } from '@/hooks/useAttendance';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import { useProfiles } from '@/hooks/useProfiles';

export function AttendanceRecordsTable() {
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date(),
  });

  const { data: records, isLoading } = useAttendanceRecords({
    officeId: officeFilter !== 'all' ? officeFilter : undefined,
    userId: userFilter !== 'all' ? userFilter : undefined,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const { data: offices } = useOfficesManagement();
  const { data: profiles } = useProfiles();

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '—';
    return format(new Date(timeString), 'hh:mm a');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
      present: { variant: 'default', icon: CheckCircle },
      absent: { variant: 'destructive', icon: XCircle },
      leave: { variant: 'secondary', icon: Clock },
      half_day: { variant: 'outline', icon: Clock },
      holiday: { variant: 'secondary', icon: CheckCircle },
    };
    const config = variants[status] || variants.present;
    return (
      <Badge variant={config.variant} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Employee:</span>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {profiles?.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">From:</span>
          <Input
            type="date"
            value={format(dateRange.start, 'yyyy-MM-dd')}
            onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
            className="w-[150px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <Input
            type="date"
            value={format(dateRange.end, 'yyyy-MM-dd')}
            onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
            className="w-[150px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>Early Departure</TableHead>
              <TableHead>Hours Worked</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No attendance records found
                </TableCell>
              </TableRow>
            ) : (
              records?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.profiles?.full_name || '—'}
                  </TableCell>
                  <TableCell>{record.offices?.name || '—'}</TableCell>
                  <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogIn className="h-3 w-3 text-muted-foreground" />
                      {formatTime(record.check_in_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogOut className="h-3 w-3 text-muted-foreground" />
                      {formatTime(record.check_out_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.is_late ? (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{record.late_minutes} min</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.is_early_departure ? (
                      <div className="flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{record.early_departure_minutes} min</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.total_hours_worked > 0 ? (
                      <span>{record.total_hours_worked.toFixed(1)} hrs</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {records?.length || 0} records
      </div>
    </div>
  );
}
