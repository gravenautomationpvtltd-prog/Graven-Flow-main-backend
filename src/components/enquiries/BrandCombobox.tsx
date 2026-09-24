import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, UserCheck, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useBrandOptions, useBrandOwnerLookup } from '@/hooks/useBrandOptions';

interface BrandComboboxProps {
  value: string;
  onChange: (brand: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Show the "→ Will route to: …" hint chip below the input. */
  showRoutingPreview?: boolean;
  className?: string;
}

export function BrandCombobox({
  value,
  onChange,
  placeholder = 'Select or type brand…',
  disabled = false,
  required = false,
  showRoutingPreview = true,
  className,
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: options, isLoading } = useBrandOptions();
  const ownerInfo = useBrandOwnerLookup(value);

  const filtered = useMemo(() => {
    if (!options) return [];
    const q = search.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options.filter((o) => o.brand.toLowerCase().includes(q)).slice(0, 100);
  }, [options, search]);

  const exactMatch = useMemo(() => {
    if (!search.trim() || !options) return true;
    return options.some((o) => o.brand.toLowerCase() === search.trim().toLowerCase());
  }, [options, search]);

  const handleSelect = (brand: string) => {
    onChange(brand);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              required && !value && 'border-destructive/40',
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type new brand…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading && (
                <div className="py-3 text-center text-xs text-muted-foreground">Loading…</div>
              )}
              {!isLoading && filtered.length === 0 && !search.trim() && (
                <CommandEmpty>No brands yet.</CommandEmpty>
              )}
              {search.trim() && !exactMatch && (
                <CommandGroup heading="New">
                  <CommandItem value={`__new__${search}`} onSelect={() => handleSelect(search.trim())}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add new brand: <span className="ml-1 font-medium">{search.trim()}</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {filtered.length > 0 && (
                <CommandGroup heading="Brands">
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.brand}
                      value={opt.brand}
                      onSelect={() => handleSelect(opt.brand)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value.toLowerCase() === opt.brand.toLowerCase() ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{opt.brand}</span>
                      {opt.hasOwner ? (
                        <Badge variant="secondary" className="ml-2 h-5 gap-1 text-[10px]">
                          <UserCheck className="h-3 w-3" />
                          {opt.ownerName || 'owned'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-2 h-5 gap-1 text-[10px]">
                          <Shuffle className="h-3 w-3" />
                          rotation
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showRoutingPreview && (
        <p className="text-[11px] text-muted-foreground">
          {!value?.trim() ? (
            <>Routes via <span className="font-medium">round-robin</span> when blank.</>
          ) : ownerInfo?.hasOwner ? (
            <>
              → Routes to{' '}
              <span className="font-medium text-foreground">{ownerInfo.ownerName || 'brand owner'}</span>{' '}
              ({value} specialist)
            </>
          ) : (
            <>→ No owner for "{value}" — will use round-robin</>
          )}
        </p>
      )}
    </div>
  );
}
