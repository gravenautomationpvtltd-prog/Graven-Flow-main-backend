import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FilterSection {
  title: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

interface LeadFilterPopoverProps {
  label: string;
  sections: FilterSection[];
  className?: string;
}

export function LeadFilterPopover({ label, sections, className }: LeadFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  // Calculate total active filters
  const activeCount = sections.reduce((acc, section) => acc + section.selectedValues.length, 0);

  const handleCheckboxChange = (section: FilterSection, value: string, checked: boolean) => {
    if (checked) {
      section.onChange([...section.selectedValues, value]);
    } else {
      section.onChange(section.selectedValues.filter(v => v !== value));
    }
  };

  const handleClearAll = () => {
    sections.forEach(section => section.onChange([]));
  };

  const handleApply = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2",
            activeCount > 0 && "bg-primary/10 border-primary text-primary hover:bg-primary/20",
            className
          )}
        >
          <Filter className="h-4 w-4" />
          {label}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-medium">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="max-h-[400px] overflow-y-auto">
          {sections.map((section, sectionIndex) => (
            <div key={section.title}>
              {sectionIndex > 0 && <Separator />}
              <div className="p-3">
                <h4 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  {section.title}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {section.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${section.title}-${option.value}`}
                        checked={section.selectedValues.includes(option.value)}
                        onCheckedChange={(checked) => 
                          handleCheckboxChange(section, option.value, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`${section.title}-${option.value}`}
                        className="text-sm font-normal cursor-pointer truncate"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="p-3 flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={activeCount === 0}
          >
            Clear All
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
