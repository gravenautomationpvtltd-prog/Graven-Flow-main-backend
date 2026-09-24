import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, ChevronsUpDown, Search, Package, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useProductsInfinite } from '@/hooks/useProducts';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';

interface Product {
  id: string;
  name: string;
  hsn_code: string | null;
  default_rate: number | null;
  purchase_price: number | null;
  unit: string | null;
  tax_rate: number | null;
  brand?: string | null;
  price_valid_until?: string | null;
}

interface ProductSearchComboboxProps {
  onSelect: (product: Product | null, customText?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductSearchCombobox({
  onSelect,
  placeholder = "Search product catalog...",
  disabled = false,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useProductsInfinite(debouncedSearch, 50);

  const allProducts = data?.pages.flatMap((page) => page.products) ?? [];

  // Scroll handler for infinite loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (bottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setOpen(false);
    setSearch('');
  };

  const handleCustomItem = () => {
    if (search.trim()) {
      onSelect(null, search.trim());
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 text-left font-normal"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">
              {placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Type product name, code..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList 
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-[300px]"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Searching catalog...</span>
              </div>
            ) : (
              <>
                {/* Custom item option when search has text */}
                {search.trim() && (
                  <CommandGroup heading="Custom Item">
                    <CommandItem
                      value={`custom-${search}`}
                      onSelect={handleCustomItem}
                      className="cursor-pointer"
                    >
                      <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium">Add as custom item</span>
                        <p className="text-xs text-muted-foreground truncate">
                          "{search}" - Not in catalog, will need pricing
                        </p>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Catalog products */}
                {allProducts.length > 0 ? (
                  <CommandGroup heading="From Catalog">
                    {allProducts.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => handleSelect(product)}
                        className="cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{product.name}</span>
                            {product.hsn_code && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {product.hsn_code}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {product.default_rate && product.default_rate > 0 ? (
                              <Badge className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                                {formatCurrencyWithSymbol(product.default_rate, 'INR')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                No Rate
                              </Badge>
                            )}
                            {product.unit && (
                              <span className="text-xs text-muted-foreground">
                                per {product.unit}
                              </span>
                            )}
                            <PriceValidityBadge validUntil={(product as any).price_valid_until} />
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4 shrink-0",
                            "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  !search.trim() && (
                    <CommandEmpty>
                      <div className="text-center py-4">
                        <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Start typing to search products
                        </p>
                      </div>
                    </CommandEmpty>
                  )
                )}

                {/* Loading more indicator */}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-xs text-muted-foreground">Loading more...</span>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
