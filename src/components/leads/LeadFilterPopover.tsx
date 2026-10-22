import { useState, useCallback, useEffect } from 'react';
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

export interface FilterSection {
  title: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange?: (values: string[]) => void;
  singleSelect?: boolean;
}

export interface LeadFilterPopoverProps {
  label: string;
  sections: FilterSection[];
  onApplySections?: (appliedValues: Record<string, string[]>) => void;
  onClearAll?: () => void;
  className?: string;
}

export function LeadFilterPopover({
  label,
  sections,
  onApplySections,
  onClearAll,
  className,
}: LeadFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  // Helper to snapshot current selected values from props
  const getCommittedValues = useCallback((): Record<string, string[]> => {
    const values: Record<string, string[]> = {};
    sections.forEach((s) => {
      values[s.title] = [...s.selectedValues];
    });
    return values;
  }, [sections]);

  // Draft values state used while the popover is open
  const [draftValues, setDraftValues] = useState<Record<string, string[]>>(getCommittedValues);

  // Sync draft whenever popover opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setDraftValues(getCommittedValues());
    }
    setOpen(newOpen);
  };

  // If props change while closed, keep draft in sync
  useEffect(() => {
    if (!open) {
      setDraftValues(getCommittedValues());
    }
  }, [open, getCommittedValues]);

  // Total active filters committed
  const activeCount = sections.reduce((acc, section) => acc + section.selectedValues.length, 0);

  // Total draft filters selected in popover
  const draftCount = Object.values(draftValues).reduce(
    (acc, vals) => acc + (vals?.length || 0),
    0
  );

  const handleToggleOption = (section: FilterSection, value: string) => {
    const current = draftValues[section.title] ?? section.selectedValues ?? [];
    let next: string[];

    if (section.singleSelect) {
      // Mutually exclusive toggle: uncheck if already selected, otherwise select only this option
      next = current.includes(value) ? [] : [value];
    } else {
      next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
    }

    setDraftValues((prev) => ({
      ...prev,
      [section.title]: next,
    }));
  };

  const handleClearAll = () => {
    const cleared: Record<string, string[]> = {};
    sections.forEach((s) => {
      cleared[s.title] = [];
    });
    setDraftValues(cleared);

    if (onClearAll) {
      onClearAll();
    } else if (onApplySections) {
      onApplySections(cleared);
    } else {
      sections.forEach((s) => s.onChange?.([]));
    }
  };

  const handleApply = () => {
    if (onApplySections) {
      onApplySections(draftValues);
    } else {
      sections.forEach((s) => {
        const vals = draftValues[s.title] ?? s.selectedValues;
        s.onChange?.(vals);
      });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          {sections.map((section, sectionIndex) => {
            const currentSelected = draftValues[section.title] ?? section.selectedValues ?? [];
            return (
              <div key={section.title}>
                {sectionIndex > 0 && <Separator />}
                <div className="p-3">
                  <h4 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    {section.title}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {section.options.map((option) => {
                      const isChecked = currentSelected.includes(option.value);
                      return (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${section.title}-${option.value}`}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleOption(section, option.value)}
                            className="rounded-full"
                          />
                          <Label
                            htmlFor={`${section.title}-${option.value}`}
                            className="text-sm font-normal cursor-pointer truncate"
                          >
                            {option.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Separator />
        <div className="p-3 flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={draftCount === 0 && activeCount === 0}
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
