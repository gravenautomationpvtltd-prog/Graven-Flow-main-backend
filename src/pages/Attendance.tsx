import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/lib/i18n';
import { AttendanceManagement } from '@/components/settings/AttendanceManagement';
import { EmployeeAttendanceDashboard } from '@/components/attendance/EmployeeAttendanceDashboard';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Attendance() {
  const { isHR, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // HR and Admin see full management view
  // Regular employees see their personal dashboard
  const isManager = isHR || isAdmin;

  // Generate years from 2020 to 2050
  const years = Array.from({ length: 31 }, (_, i) => 2020 + i);
  
  // Months array
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {isManager ? t('attendance.management', 'Attendance Management') : t('attendance.my_attendance', 'My Attendance')}
          </h1>
          <p className="text-muted-foreground">
            {isManager
              ? t('attendance.management_desc', 'Track employee attendance, manage leave requests, and view reports')
              : t('attendance.my_desc', 'View your attendance, check in/out, and manage leave requests')}
          </p>
        </div>
        
        {!isManager && (
          <div className="flex items-center gap-2">
            {/* Month Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-[140px] justify-between">
                  {months[selectedMonth]}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuLabel>Select Month</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[280px]">
                  {months.map((month, index) => (
                    <DropdownMenuItem 
                      key={month}
                      onClick={() => handleMonthSelect(index)}
                      className={selectedMonth === index ? 'bg-accent' : ''}
                    >
                      {month}
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Year Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 min-w-[100px] justify-between">
                  {selectedYear}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[120px]">
                <DropdownMenuLabel>Select Year</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[280px]">
                  {years.map((year) => (
                    <DropdownMenuItem 
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={selectedYear === year ? 'bg-accent' : ''}
                    >
                      {year}
                    </DropdownMenuItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      {isManager ? (
        <AttendanceManagement />
      ) : (
        <EmployeeAttendanceDashboard 
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}
    </div>
  );
}
