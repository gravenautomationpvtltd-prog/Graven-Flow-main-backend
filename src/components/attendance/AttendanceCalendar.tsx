import { useState } from 'react';
import { useYearlyAttendanceCalendar } from '@/hooks/useAttendanceStats';
import { useHolidaysInRange, getHolidayTypeColor } from '@/hooks/useHolidays';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, getDay, isWeekend, isToday, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceCalendarProps {
  userId: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AttendanceCalendar({ userId }: AttendanceCalendarProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const { data: calendarData, isLoading } = useYearlyAttendanceCalendar(userId, selectedYear);
  
  // Fetch holidays for the year
  const yearStart = format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd');
  const { data: holidays } = useHolidaysInRange(yearStart, yearEnd);
  
  // Create holiday map for quick lookup
  const holidayMap = new Map<string, string>();
  holidays?.forEach(h => holidayMap.set(h.date, h.name));
  // Generate years from 2020 to 2050 (practical unlimited range)
  const START_YEAR = 2020;
  const END_YEAR = 2050;
  const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Generate days for selected month
  const monthDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const emptyCells = Array(startDay).fill(null);

  if (isLoading) {
    return <Skeleton className="h-80 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with dropdowns and navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, i) => (
                <SelectItem key={i} value={i.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[90px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Leave</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full ring-2 ring-orange-400" />
            <span className="text-muted-foreground">Late</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Holiday</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg p-4 bg-card relative z-0">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day, i) => (
            <div key={i} className="text-xs text-center text-muted-foreground font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells */}
          {emptyCells.map((_, i) => (
            <div key={`empty-${i}`} className="w-full aspect-square" />
          ))}

          {/* Day cells */}
          <TooltipProvider>
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const data = calendarData?.[dateStr];
              const isWeekendDay = isWeekend(day);
              const isTodayDate = isToday(day);
              const isFutureDate = isFuture(day);
              const holidayName = holidayMap.get(dateStr);
              const isHoliday = !!holidayName;

              let bgColor = 'bg-muted/30';
              let textColor = 'text-foreground';
              let ringColor = '';

              if (isFutureDate) {
                bgColor = '';
                textColor = 'text-muted-foreground/40';
              } else if (isHoliday) {
                bgColor = 'bg-amber-500';
                textColor = 'text-white';
              } else if (data) {
                if (data.status === 'present') {
                  bgColor = 'bg-green-500';
                  textColor = 'text-white';
                  if (data.isLate) {
                    ringColor = 'ring-2 ring-orange-400 ring-offset-2 ring-offset-background';
                  }
                } else if (data.status === 'absent') {
                  bgColor = 'bg-red-500';
                  textColor = 'text-white';
                } else if (data.status === 'leave') {
                  bgColor = 'bg-blue-500';
                  textColor = 'text-white';
                }
              } else if (isWeekendDay) {
                bgColor = 'bg-muted/20';
                textColor = 'text-muted-foreground/60';
              }

              const dayElement = (
                <div
                  key={dateStr}
                  className={cn(
                    "w-full aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                    bgColor,
                    textColor,
                    ringColor,
                    isTodayDate && !data && !isHoliday && "ring-2 ring-primary",
                    isTodayDate && (data || isHoliday) && "ring-2 ring-white ring-offset-2 ring-offset-background"
                  )}
                >
                  {format(day, 'd')}
                </div>
              );

              if (isHoliday) {
                return (
                  <Tooltip key={dateStr}>
                    <TooltipTrigger asChild>
                      {dayElement}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{holidayName}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return dayElement;
            })}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
