import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useUpdateHoliday, type Holiday } from '@/hooks/useHolidays';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import type { Database } from '@/integrations/supabase/types';

type HolidayType = Database['public']['Enums']['holiday_type'];

interface EditHolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday: Holiday | null;
}

export function EditHolidayDialog({ open, onOpenChange, holiday }: EditHolidayDialogProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [holidayType, setHolidayType] = useState<HolidayType>('company');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const { data: offices } = useOfficesManagement();
  const updateHoliday = useUpdateHoliday();

  useEffect(() => {
    if (holiday) {
      setName(holiday.name);
      setDate(parseISO(holiday.date));
      setHolidayType(holiday.holiday_type);
      setIsHalfDay(holiday.is_half_day || false);
      setHalfDayType(holiday.half_day_type);
      setOfficeId(holiday.office_id);
      setDescription(holiday.description || '');
      setIsRecurring(holiday.is_recurring || false);
    }
  }, [holiday]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!holiday || !name || !date) return;

    updateHoliday.mutate(
      {
        id: holiday.id,
        name,
        date: format(date, 'yyyy-MM-dd'),
        holiday_type: holidayType,
        is_half_day: isHalfDay,
        half_day_type: isHalfDay ? halfDayType : null,
        office_id: officeId,
        description: description || null,
        is_recurring: isRecurring,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Holiday</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Holiday Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Diwali, Independence Day"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Holiday Type</Label>
            <Select value={holidayType} onValueChange={(v) => setHolidayType(v as HolidayType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national">National Holiday</SelectItem>
                <SelectItem value="company">Company Holiday</SelectItem>
                <SelectItem value="regional">Regional Holiday</SelectItem>
                <SelectItem value="optional">Optional Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Office (Leave empty for all offices)</Label>
            <Select value={officeId || 'all'} onValueChange={(v) => setOfficeId(v === 'all' ? null : v)}>
              <SelectTrigger>
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

          <div className="flex items-center justify-between">
            <Label htmlFor="half-day">Half Day Holiday</Label>
            <Switch
              id="half-day"
              checked={isHalfDay}
              onCheckedChange={setIsHalfDay}
            />
          </div>

          {isHalfDay && (
            <div className="space-y-2">
              <Label>Which Half</Label>
              <Select value={halfDayType || ''} onValueChange={setHalfDayType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select half" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_half">First Half (Morning)</SelectItem>
                  <SelectItem value="second_half">Second Half (Afternoon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="recurring">Recurring Every Year</Label>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes about this holiday"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateHoliday.isPending || !name || !date}>
              {updateHoliday.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
