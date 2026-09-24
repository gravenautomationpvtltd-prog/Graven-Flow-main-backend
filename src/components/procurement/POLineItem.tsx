import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProductSearch } from '@/hooks/useQuotations';

export interface POLineItemData {
  id: string;
  product_id: string | null;
  description: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  tax_percent: number;
  tax_amount: number;
  amount: number;
  received_quantity: number;
}

interface POLineItemProps {
  item: POLineItemData;
  index: number;
  onChange: (index: number, field: keyof POLineItemData, value: unknown) => void;
  onProductSelect: (index: number, productId: string | null, product?: { name: string; hsn_code: string | null; default_rate: number | null; tax_rate: number | null }) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function POLineItem({ item, index, onChange, onProductSelect, onRemove, canRemove }: POLineItemProps) {
  const [productOpen, setProductOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Server-side product search
  const { data: searchResults = [], isLoading: isSearching } = useProductSearch(debouncedSearch);

  const handleProductSelect = (productId: string) => {
    if (productId === 'custom') {
      onProductSelect(index, null);
    } else {
      const product = searchResults.find(p => p.id === productId);
      onProductSelect(index, productId, product ? {
        name: product.name,
        hsn_code: product.hsn_code,
        default_rate: product.default_rate,
        tax_rate: product.tax_rate
      } : undefined);
    }
    setProductOpen(false);
    setSearchQuery('');
  };

  const itemAmount = item.quantity * item.rate;
  const taxAmount = (itemAmount * item.tax_percent) / 100;
  const totalAmount = itemAmount + taxAmount;

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
      <div className="col-span-12 md:col-span-3">
        <Label className="text-xs">Product</Label>
        <Popover open={productOpen} onOpenChange={(open) => {
          setProductOpen(open);
          if (!open) setSearchQuery('');
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between text-left font-normal h-9"
            >
              <span className="truncate">
                {item.description || (item.product_id ? 'Selected Product' : 'Select product...')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Type to search products..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Searching...</span>
                  </div>
                ) : searchQuery.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type to search products...
                  </div>
                ) : searchResults.length === 0 ? (
                  <CommandEmpty>No products found.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    <CommandItem value="custom" onSelect={() => handleProductSelect('custom')}>
                      <Check className={cn('mr-2 h-4 w-4', !item.product_id ? 'opacity-100' : 'opacity-0')} />
                      Custom Item
                    </CommandItem>
                    {searchResults.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => handleProductSelect(product.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', item.product_id === product.id ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          {product.hsn_code && (
                            <span className="text-xs text-muted-foreground">HSN: {product.hsn_code}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="col-span-12 md:col-span-3">
        <Label className="text-xs">Description</Label>
        <Input
          value={item.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          placeholder="Item description"
          className="h-9"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label className="text-xs">HSN</Label>
        <Input
          value={item.hsn_code || ''}
          onChange={(e) => onChange(index, 'hsn_code', e.target.value)}
          placeholder="HSN"
          className="h-9"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label className="text-xs">Qty</Label>
        <Input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onChange(index, 'quantity', parseFloat(e.target.value) || 1)}
          className="h-9"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label className="text-xs">Rate</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={item.rate}
          onChange={(e) => onChange(index, 'rate', parseFloat(e.target.value) || 0)}
          className="h-9"
        />
      </div>

      <div className="col-span-4 md:col-span-1">
        <Label className="text-xs">Tax %</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={item.tax_percent}
          onChange={(e) => onChange(index, 'tax_percent', parseFloat(e.target.value) || 0)}
          className="h-9"
        />
      </div>

      <div className="col-span-6 md:col-span-1">
        <Label className="text-xs">Amount</Label>
        <div className="h-9 flex items-center px-3 bg-background border rounded-md text-sm font-medium">
          ₹{totalAmount.toFixed(2)}
        </div>
      </div>

      <div className="col-span-2 md:col-span-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="h-9 w-9"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
