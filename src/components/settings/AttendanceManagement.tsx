import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, FileText, AlertTriangle, CalendarDays } from 'lucide-react';
import { AttendanceRecordsTable } from './AttendanceRecordsTable';
import { LeaveRequestsTable } from './LeaveRequestsTable';
import { AttendanceReports } from './AttendanceReports';
import { HolidayCalendarManagement } from './HolidayCalendarManagement';
import { useAuth } from '@/hooks/useAuth';

export function AttendanceManagement() {
  const { hasRole, isAdmin } = useAuth();
  const isHrOrAdmin = isAdmin || hasRole('hr');

  if (!isHrOrAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">
            Only HR and Admin users can access attendance management.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Attendance Management</CardTitle>
            <CardDescription>
              Track employee attendance, manage leave requests, and view reports
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="records" className="space-y-4">
          <TabsList>
            <TabsTrigger value="records" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Records
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave Requests
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Holidays
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records">
            <AttendanceRecordsTable />
          </TabsContent>

          <TabsContent value="leave">
            <LeaveRequestsTable />
          </TabsContent>

          <TabsContent value="reports">
            <AttendanceReports />
          </TabsContent>

          <TabsContent value="holidays">
            <HolidayCalendarManagement />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
