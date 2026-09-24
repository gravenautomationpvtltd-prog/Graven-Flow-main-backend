import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DatePreset = 
  | 'this_month' 
  | 'last_month' 
  | 'last_30_days' 
  | 'last_90_days' 
  | 'this_year' 
  | 'last_year'
  | 'custom'
  | 'all_time';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateRangeFilterProps {
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customFrom?: Date;
  customTo?: Date;
  onCustomFromChange?: (date: Date | undefined) => void;
  onCustomToChange?: (date: Date | undefined) => void;
  className?: string;
  showAllTime?: boolean;
}

export function getDateRangeFromPreset(preset: DatePreset, customFrom?: Date, customTo?: Date): DateRange {
  const today = new Date();
  
  switch (preset) {
    case 'this_month':
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    case 'last_30_days':
      return {
        from: subDays(today, 30),
        to: today,
      };
    case 'last_90_days':
      return {
        from: subDays(today, 90),
        to: today,
      };
    case 'this_year':
      return {
        from: startOfYear(today),
        to: endOfYear(today),
      };
    case 'last_year':
      const lastYear = subMonths(today, 12);
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear),
      };
    case 'custom':
      return {
        from: customFrom,
        to: customTo,
      };
    case 'all_time':
    default:
      return {
        from: undefined,
        to: undefined,
      };
  }
}

const presetLabels: Record<DatePreset, string> = {
  all_time: 'All Time',
  this_month: 'This Month',
  last_month: 'Last Month',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
  this_year: 'This Year',
  last_year: 'Last Year',
  custom: 'Custom Range',
};

export function DateRangeFilter({
  datePreset,
  onDatePresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  className,
  showAllTime = true,
}: DateRangeFilterProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const handlePresetChange = (value: string) => {
    onDatePresetChange(value as DatePreset);
  };

  const handleClear = () => {
    onDatePresetChange('all_time');
    onCustomFromChange?.(undefined);
    onCustomToChange?.(undefined);
  };

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <Select value={datePreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[160px]">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {showAllTime && <SelectItem value="all_time">{presetLabels.all_time}</SelectItem>}
          <SelectItem value="this_month">{presetLabels.this_month}</SelectItem>
          <SelectItem value="last_month">{presetLabels.last_month}</SelectItem>
          <SelectItem value="last_30_days">{presetLabels.last_30_days}</SelectItem>
          <SelectItem value="last_90_days">{presetLabels.last_90_days}</SelectItem>
          <SelectItem value="this_year">{presetLabels.this_year}</SelectItem>
          <SelectItem value="last_year">{presetLabels.last_year}</SelectItem>
          <SelectItem value="custom">{presetLabels.custom}</SelectItem>
        </SelectContent>
      </Select>

      {datePreset === 'custom' && (
        <>
          <Popover open={fromOpen} onOpenChange={setFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[130px] justify-start text-left font-normal',
                  !customFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customFrom ? format(customFrom, 'MMM d, yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(date) => {
                  onCustomFromChange?.(date);
                  setFromOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">to</span>

          <Popover open={toOpen} onOpenChange={setToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[130px] justify-start text-left font-normal',
                  !customTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customTo ? format(customTo, 'MMM d, yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(date) => {
                  onCustomToChange?.(date);
                  setToOpen(false);
                }}
                disabled={(date) => customFrom ? date < customFrom : false}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </>
      )}

      {datePreset !== 'all_time' && showAllTime && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClear}
          title="Clear date filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
