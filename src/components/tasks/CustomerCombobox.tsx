import { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useInfiniteCustomers, useCustomer } from '@/hooks/useCustomers';

interface CustomerComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  assignedSalesId?: string;
}

export function CustomerCombobox({ 
  value, 
  onValueChange, 
  placeholder = "Select customer...",
  assignedSalesId
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { 
    data, 
    isLoading, 
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage 
  } = useInfiniteCustomers({
    search: debouncedSearch,
    pageSize: 50,
    assignedSalesId
  });

  // Fetch selected customer by ID (fallback if not in loaded pages)
  const { data: selectedCustomerData } = useCustomer(value);

  // Flatten all pages into a single list
  const allCustomers = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Find selected customer from loaded pages or fallback
  const selectedCustomer = useMemo(() => {
    const fromPages = allCustomers.find((c) => c.id === value);
    if (fromPages) return fromPages;
    return selectedCustomerData;
  }, [allCustomers, value, selectedCustomerData]);

  // Handle scroll to load more
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Load more when within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedCustomer ? (
            <span className="truncate">
              {selectedCustomer.company_name}
              {selectedCustomer.contact_person && (
                <span className="text-muted-foreground ml-1">
                  ({selectedCustomer.contact_person})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1">
            {value && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange('');
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search customers..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} onScroll={handleScroll}>
          {isLoading && !data ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading customers...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-6 text-destructive">
                <span className="text-sm">Failed to load customers</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {error?.message || 'Please try again'}
                </span>
              </div>
            ) : allCustomers.length === 0 ? (
              <CommandEmpty>No customer found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {allCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue === value ? '' : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === customer.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{customer.company_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          customer.contact_person,
                          customer.phone,
                          (customer as any).assigned_sales?.full_name && `Sales: ${(customer as any).assigned_sales.full_name}`
                        ].filter(Boolean).join(' • ') || '—'}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    <span className="text-xs text-muted-foreground">Loading more...</span>
                  </div>
                )}
                {!isFetchingNextPage && allCustomers.length < totalCount && (
                  <div className="text-xs text-center text-muted-foreground py-2">
                    Showing {allCustomers.length} of {totalCount} customers
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
