import { useState } from 'react';
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCreateHoliday } from '@/hooks/useHolidays';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import type { Database } from '@/integrations/supabase/types';

type HolidayType = Database['public']['Enums']['holiday_type'];

interface AddHolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddHolidayDialog({ open, onOpenChange }: AddHolidayDialogProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [holidayType, setHolidayType] = useState<HolidayType>('company');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const { data: offices } = useOfficesManagement();
  const createHoliday = useCreateHoliday();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !date) return;

    createHoliday.mutate(
      {
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
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setName('');
    setDate(undefined);
    setHolidayType('company');
    setIsHalfDay(false);
    setHalfDayType(null);
    setOfficeId(null);
    setDescription('');
    setIsRecurring(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Holiday</DialogTitle>
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
            <Button type="submit" disabled={createHoliday.isPending || !name || !date}>
              {createHoliday.isPending ? 'Adding...' : 'Add Holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
