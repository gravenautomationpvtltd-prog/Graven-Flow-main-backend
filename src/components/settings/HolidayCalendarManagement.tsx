import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Calendar, List, RefreshCw } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { useHolidays, useDeleteHoliday, getHolidayTypeLabel, getHolidayTypeColor, type Holiday } from '@/hooks/useHolidays';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import { AddHolidayDialog } from './AddHolidayDialog';
import { EditHolidayDialog } from './EditHolidayDialog';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

const MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'calendar' | 'list';

export function HolidayCalendarManagement() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [officeFilter, setOfficeFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);

  const { data: holidays, isLoading, refetch } = useHolidays(selectedYear, officeFilter);
  const { data: offices } = useOfficesManagement();
  const deleteHoliday = useDeleteHoliday();

  const years = Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const handleEdit = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setEditDialogOpen(true);
  };

  const handleDelete = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedHoliday) {
      deleteHoliday.mutate(selectedHoliday.id);
    }
  };

  // Generate calendar for selected month
  const monthDate = new Date(selectedYear, selectedMonth, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const emptyCells = Array(startDay).fill(null);

  // Create a map of holidays by date for quick lookup
  const holidaysByDate = new Map<string, Holiday[]>();
  holidays?.forEach(holiday => {
    const dateKey = holiday.date;
    if (!holidaysByDate.has(dateKey)) {
      holidaysByDate.set(dateKey, []);
    }
    holidaysByDate.get(dateKey)!.push(holiday);
  });

  return (
    <div className="space-y-4">
      {/* Header with filters and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {viewMode === 'calendar' && (
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i} value={i.toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={officeFilter || 'all'} onValueChange={(v) => setOfficeFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Offices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {offices?.map((office) => (
                <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="rounded-l-none"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Total: <strong className="text-foreground">{holidays?.length || 0}</strong> holidays in {selectedYear}</span>
        <span>National: <strong className="text-red-500">{holidays?.filter(h => h.holiday_type === 'national').length || 0}</strong></span>
        <span>Company: <strong className="text-orange-500">{holidays?.filter(h => h.holiday_type === 'company').length || 0}</strong></span>
        <span>Optional: <strong className="text-yellow-500">{holidays?.filter(h => h.holiday_type === 'optional').length || 0}</strong></span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Half Day</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No holidays found for {selectedYear}
                  </TableCell>
                </TableRow>
              ) : (
                holidays?.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(holiday.date), 'dd MMM yyyy')}
                      <span className="text-muted-foreground ml-2">
                        ({format(parseISO(holiday.date), 'EEEE')})
                      </span>
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Badge className={cn(getHolidayTypeColor(holiday.holiday_type), 'text-white')}>
                        {getHolidayTypeLabel(holiday.holiday_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {holiday.offices?.name || 'All Offices'}
                    </TableCell>
                    <TableCell>
                      {holiday.is_half_day ? (
                        <Badge variant="outline">
                          {holiday.half_day_type === 'first_half' ? 'Morning' : 'Afternoon'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Full Day</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {holiday.is_recurring ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(holiday)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(holiday)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Calendar View */
        <div className="border rounded-lg p-4 bg-card">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>National</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>Company</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-500" />
              <span>Regional</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span>Optional</span>
            </div>
          </div>

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
            {emptyCells.map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayHolidays = holidaysByDate.get(dateStr) || [];
              const isWeekendDay = isWeekend(day);
              const hasHoliday = dayHolidays.length > 0;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "aspect-square rounded-lg p-1 text-sm border transition-all",
                    isWeekendDay && !hasHoliday && "bg-muted/30 text-muted-foreground",
                    hasHoliday && getHolidayTypeColor(dayHolidays[0].holiday_type),
                    hasHoliday && "text-white cursor-pointer hover:opacity-80"
                  )}
                  onClick={() => hasHoliday && handleEdit(dayHolidays[0])}
                  title={hasHoliday ? dayHolidays.map(h => h.name).join(', ') : undefined}
                >
                  <div className="font-medium">{format(day, 'd')}</div>
                  {hasHoliday && (
                    <div className="text-[10px] truncate leading-tight mt-0.5">
                      {dayHolidays[0].name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddHolidayDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditHolidayDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} holiday={selectedHoliday} />
      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Holiday"
        description={`Are you sure you want to delete "${selectedHoliday?.name || 'this holiday'}"?`}
        isLoading={deleteHoliday.isPending}
      />
    </div>
  );
}
