import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Package, IndianRupee, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateOrUpdateInventory } from '@/hooks/useInventory';
import { useProductSearch } from '@/hooks/useQuotations';

interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInventoryDialog({ open, onOpenChange }: AddInventoryDialogProps) {
  const [officeId, setOfficeId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [maxStockLevel, setMaxStockLevel] = useState('');
  const [productOpen, setProductOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    hsn_code: string | null;
    unit: string | null;
    default_rate: number | null;
  } | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: offices = [], isLoading: officesLoading } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Server-side product search
  const { data: searchResults = [], isLoading: isSearching } = useProductSearch(debouncedSearch);

  const createOrUpdate = useCreateOrUpdateInventory();

  const estimatedValue = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const rate = selectedProduct?.default_rate || 0;
    return qty * rate;
  }, [quantity, selectedProduct]);

  const handleProductSelect = (product: typeof searchResults[0]) => {
    setProductId(product.id);
    setSelectedProduct({
      id: product.id,
      name: product.name,
      hsn_code: product.hsn_code,
      unit: product.unit,
      default_rate: product.default_rate,
    });
    setProductOpen(false);
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeId || !productId || !quantity) return;

    await createOrUpdate.mutateAsync({
      office_id: officeId,
      product_id: productId,
      quantity: parseFloat(quantity),
      min_stock_level: minStockLevel ? parseFloat(minStockLevel) : 0,
      max_stock_level: maxStockLevel ? parseFloat(maxStockLevel) : null,
    });

    // Reset form
    setOfficeId('');
    setProductId('');
    setSelectedProduct(null);
    setQuantity('');
    setMinStockLevel('');
    setMaxStockLevel('');
    onOpenChange(false);
  };

  const isValid = officeId && productId && quantity && parseFloat(quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Stock Item
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Office Selection */}
          <div className="space-y-2">
            <Label htmlFor="office" className="text-sm font-medium">
              Office <span className="text-destructive">*</span>
            </Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger className={cn(!officeId && "text-muted-foreground")}>
                <SelectValue placeholder={officesLoading ? "Loading offices..." : "Select office"} />
              </SelectTrigger>
              <SelectContent>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Where will this stock be stored?</p>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Product <span className="text-destructive">*</span>
            </Label>
            <Popover open={productOpen} onOpenChange={(open) => {
              setProductOpen(open);
              if (!open) setSearchQuery('');
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className={cn("w-full justify-between", !productId && "text-muted-foreground")}
                >
                  {productId && selectedProduct ? (
                    selectedProduct.name
                  ) : (
                    "Type to search products..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
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
                      <CommandEmpty>No product found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {searchResults.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => handleProductSelect(product)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                productId === product.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {product.hsn_code && `HSN: ${product.hsn_code} • `}
                                ₹{(product.default_rate || 0).toLocaleString('en-IN')}/{product.unit || 'Nos'}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedProduct && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <IndianRupee className="h-3 w-3" />
                <span>Rate: ₹{(selectedProduct.default_rate || 0).toLocaleString('en-IN')} per {selectedProduct.unit || 'Nos'}</span>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              Initial Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              className={cn(quantity && parseFloat(quantity) <= 0 && "border-destructive")}
            />
            {estimatedValue > 0 && (
              <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded-md px-3 py-2">
                <IndianRupee className="h-4 w-4" />
                <span>Estimated Value: ₹{estimatedValue.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Stock Levels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minStock" className="text-sm font-medium">Min Stock Level</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Alert when below this</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStock" className="text-sm font-medium">Max Stock Level</Label>
              <Input
                id="maxStock"
                type="number"
                min="0"
                value={maxStockLevel}
                onChange={(e) => setMaxStockLevel(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground">Maximum capacity</p>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || createOrUpdate.isPending}>
              {createOrUpdate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
