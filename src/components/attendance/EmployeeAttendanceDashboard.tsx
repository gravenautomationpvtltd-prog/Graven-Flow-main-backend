import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserOffice } from '@/hooks/useLocationAttendance';
import { CheckInOutCard } from './CheckInOutCard';
import { AttendanceHistory } from './AttendanceHistory';
import { MyLeaveRequests } from './MyLeaveRequests';
import { AttendanceQuickStats } from './AttendanceQuickStats';
import { LeaveRequestDialog } from './LeaveRequestDialog';

interface EmployeeAttendanceDashboardProps {
  selectedMonth: number;
  selectedYear: number;
}

export function EmployeeAttendanceDashboard({ selectedMonth, selectedYear }: EmployeeAttendanceDashboardProps) {
  const { user, profile } = useAuth();
  const { data: userOffice } = useUserOffice(profile?.office_id);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <AttendanceQuickStats 
        userId={user.id} 
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column - Attendance History (60%) */}
        <div className="lg:col-span-3">
          <AttendanceHistory 
            userId={user.id} 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </div>

        {/* Right Column - Action Card & Leave (40%) */}
        <div className="lg:col-span-2 space-y-6">
          <CheckInOutCard userOffice={userOffice} />
          <MyLeaveRequests 
            userId={user.id} 
            onRequestLeave={() => setShowLeaveDialog(true)} 
          />
        </div>
      </div>

      <LeaveRequestDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog} />
    </div>
  );
}
