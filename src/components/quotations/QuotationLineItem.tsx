import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Trash2, GripVertical, Check, ChevronsUpDown, Plus, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductDialog } from '@/components/settings/ProductDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useProductSearch, computePriceFloor, type QuotationItem, type Product } from '@/hooks/useQuotations';
import { getPriceAge, getPriceAgeColor } from '@/lib/price-age-utils';
import { checkMargin } from '@/lib/pricing';
import { pickBestDescription } from '@/lib/description-utils';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import { RequestRevisePriceButton } from '@/components/quotations/RequestRevisePriceButton';
import { supabase } from '@/integrations/supabase/client';
import { useMinMarginPct } from '@/hooks/useCompanySettings';
import { useReadyStockMap, useProductStock } from '@/hooks/useReadyStock';
import { applyReadyStockPremium, READY_STOCK_PREMIUM_PCT } from '@/lib/ready-stock';

interface QuotationLineItemProps {
  item: QuotationItem;
  index: number;
  onUpdate: (index: number, field: keyof QuotationItem, value: unknown) => void;
  onRemove: (index: number) => void;
  onProductSelect: (index: number, productId: string) => void;
  selectedProductName?: string;
  selectedProductModel?: string | null;
}

export function QuotationLineItem({
  item,
  index,
  onUpdate,
  onRemove,
  onProductSelect,
  selectedProductName,
  selectedProductModel,
}: QuotationLineItemProps) {
  const { data: tenantMinMargin } = useMinMarginPct();
  const [open, setOpen] = useState(false);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Internal-only list-price context (never shown to customer)
  const [productLP, setProductLP] = useState<{
    list_price: number | null;
    min_margin_pct: number | null;
    source: string | null;
    model_number: string | null;
    price_valid_until: string | null;
    product_status: string | null;
    purchase_price: number | null;
    replacement_model_no: string | null;
  }>({ list_price: null, min_margin_pct: null, source: null, model_number: null, price_valid_until: null, product_status: null, purchase_price: null, replacement_model_no: null });
  const queryClient = useQueryClient();
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Server-side product search
  const { data: searchResults = [], isLoading: isSearching } = useProductSearch(debouncedSearch);

  // Warehouse availability for the products currently shown in the picker
  const { data: stockMap } = useReadyStockMap(searchResults.map((p) => p.id));
  // Warehouse availability for the product already on this line
  const { data: lineStock } = useProductStock(item.product_id || undefined);
  const isReadyStock = (lineStock?.qty ?? 0) > 0;
  // Base (non-premium) selling price captured when the product was picked
  const [readyStockBase, setReadyStockBase] = useState<number | null>(null);
  const premiumRate = applyReadyStockPremium(readyStockBase);
  const premiumApplied =
    isReadyStock && premiumRate !== null && Math.abs(Number(item.rate) - premiumRate) < 0.5;

  // Pull the catalog price validity for an already-linked product
  useEffect(() => {
    let cancelled = false;
    const pid = item.product_id;
    if (!pid) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('price_valid_until, list_price, min_margin_pct, list_price_source, model_number, product_status, purchase_price, replacement_model_no, sales_price, default_rate')
        .eq('id', pid)
        .maybeSingle();
      if (cancelled || !data) return;
      setReadyStockBase((prev) => prev ?? (data as any).sales_price ?? (data as any).default_rate ?? null);
      setProductLP((prev) => ({
        list_price: prev.list_price ?? (data as any).list_price ?? null,
        min_margin_pct: prev.min_margin_pct ?? (data as any).min_margin_pct ?? null,
        source: prev.source ?? (data as any).list_price_source ?? null,
        model_number: prev.model_number ?? (data as any).model_number ?? null,
        price_valid_until: (data as any).price_valid_until ?? null,
        product_status: (data as any).product_status ?? null,
        purchase_price: (data as any).purchase_price ?? null,
        replacement_model_no: (data as any).replacement_model_no ?? null,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [item.product_id]);

  // Catalog price validity lapsed → sales can ask procurement for a revised/target price
  const priceExpired = (() => {
    if (!item.product_id) return false;
    if (!productLP.price_valid_until) return false;
    const d = new Date(productLP.price_valid_until);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  })();

  // Use description as fallback when product name isn't available (e.g., pre-populated from enquiry items)
  const displayName = selectedProductModel || selectedProductName || 
    (item.description ? item.description.split(' - ')[0] : '') || 
    (item.product_id ? 'Product' : 'Custom Item');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleProductCreated = (newProduct: { id: string; name: string; description?: string | null; model_number?: string | null; hsn_code?: string | null; unit?: string | null; default_rate?: number | null; tax_rate?: number | null }) => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['products-search'] });

    // Directly set product_id and description via onUpdate instead of onProductSelect
    // This ensures the product is selected immediately without waiting for products array to refresh.
    // Documents print only model number + description — never the product name.
    onUpdate(index, 'product_id', newProduct.id);
    onUpdate(index, 'description', newProduct.description || newProduct.model_number || '');
    if (newProduct.model_number) onUpdate(index, 'model_number', newProduct.model_number);
    
    // Populate other line item fields with product details
    if (newProduct.hsn_code) onUpdate(index, 'hsn_code', newProduct.hsn_code);
    if (newProduct.unit) onUpdate(index, 'unit', newProduct.unit);
    if (newProduct.default_rate) onUpdate(index, 'rate', newProduct.default_rate);
    if (newProduct.tax_rate !== undefined && newProduct.tax_rate !== null) onUpdate(index, 'tax_percent', newProduct.tax_rate);
    setSearchQuery('');
  };

  const handleSelectProduct = (product: Product & { lead_time_days?: number | null }) => {
    // Directly set product fields via onUpdate instead of relying on onProductSelect lookup
    // This ensures the product is selected immediately with all details
    const productDescription = pickBestDescription(
      item.product_description || item.description,
      product.description || null,
      product.model_number || null,
    );
    onUpdate(index, 'product_id', product.id);
    onUpdate(index, 'model_number', product.model_number ?? null);
    onUpdate(index, 'product_description', productDescription || null);
    onUpdate(index, 'description', productDescription || product.model_number || '');
    if (product.hsn_code) onUpdate(index, 'hsn_code', product.hsn_code);
    if (product.unit) onUpdate(index, 'unit', product.unit);
    const autoRate = (product as any).sales_price ?? product.default_rate;
    // Ready stock (available in a warehouse) is quoted at a 5% premium by default
    const stockQty = stockMap?.get(product.id)?.qty ?? 0;
    setReadyStockBase(autoRate ?? null);
    const finalRate = stockQty > 0 ? applyReadyStockPremium(autoRate) : autoRate;
    if (finalRate !== null && finalRate !== undefined) onUpdate(index, 'rate', finalRate);
    if (product.tax_rate !== null && product.tax_rate !== undefined) onUpdate(index, 'tax_percent', product.tax_rate);
    // Auto-populate lead time from product catalog
    if (product.lead_time_days !== null && product.lead_time_days !== undefined) {
      onUpdate(index, 'lead_time_days', product.lead_time_days);
    }
    // Stash internal list-price context so we can display the floor to internal user
    setProductLP({
      list_price: product.list_price ?? null,
      min_margin_pct: product.min_margin_pct ?? null,
      source: product.list_price_source ?? null,
      model_number: product.model_number ?? null,
      price_valid_until: (product as any).price_valid_until ?? null,
      product_status: (product as any).product_status ?? null,
      purchase_price: (product as any).purchase_price ?? null,
      replacement_model_no: (product as any).replacement_model_no ?? null,
    });

    setOpen(false);
    setSearchQuery('');
  };

  // Internal-only pricing floor (never shown to customer, never printed on PDF)
  const { floor: internalFloor, floorApplied } = computePriceFloor(
    { list_price: productLP.list_price, min_margin_pct: productLP.min_margin_pct },
    Number(item.rate) || 0,
  );

  // Internal margin guard — never printed on the PDF
  const marginCheck = checkMargin(
    Number(item.rate) || 0,
    productLP.purchase_price,
    productLP.min_margin_pct ?? tenantMinMargin,
  );
  const lifecycleStatus = productLP.product_status;
  const isObsolete = lifecycleStatus === 'obsolete';
  const isDiscontinued = lifecycleStatus === 'discontinued';

  // Format lead time for display
  const formatLeadTime = (days: number | null | undefined) => {
    if (days === null || days === undefined) return '-';
    if (days <= 7) return `${days}d`;
    const weeks = Math.ceil(days / 7);
    return `${weeks}w`;
  };

  return (
    <>
      <div className="group flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border border-border/50 hover:border-border transition-colors">
        {/* Row 1 — Product + Description (full width) */}
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center pt-2 w-8 shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <span className="text-xs text-muted-foreground ml-1">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="min-h-9 h-auto py-2 w-full justify-between text-sm font-normal whitespace-normal text-left items-start"
                >
                  <span className="whitespace-normal break-words flex-1">{displayName}</span>
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 mt-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search products..."
                    className="h-8 text-xs"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    {isSearching && (
                      <div className="py-6 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                      </div>
                    )}
                    {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                      <CommandEmpty className="py-2 px-2">
                        <p className="text-sm text-muted-foreground mb-2">No products found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => {
                            setOpen(false);
                            setAddProductDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Add "{searchQuery}" as new product
                        </Button>
                      </CommandEmpty>
                    )}
                    <CommandGroup>
                      <CommandItem
                        value="custom"
                        onSelect={() => {
                          onProductSelect(index, 'custom');
                          setOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <Check className={cn("mr-2 h-3 w-3", !item.product_id ? "opacity-100" : "opacity-0")} />
                        Custom Item
                      </CommandItem>
                      <CommandItem
                        value="__add_new_product__"
                        onSelect={() => {
                          setOpen(false);
                          setAddProductDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3 text-primary" />
                        <span className="text-primary">Add New Product...</span>
                      </CommandItem>
                      {searchResults.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => handleSelectProduct(product)}
                        >
                          <Check className={cn("mr-2 h-3 w-3 flex-shrink-0", item.product_id === product.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col flex-1 min-w-0">
                             <div className="flex items-center justify-between gap-2">
                               <span className="truncate">{product.model_number || product.name}</span>
                               {(stockMap?.get(product.id)?.qty ?? 0) > 0 && (
                                 <span className="text-[10px] font-semibold flex-shrink-0 rounded px-1.5 py-0.5 bg-green-500/10 text-green-700 border border-green-200">
                                   Ready Stock · {stockMap!.get(product.id)!.qty}
                                 </span>
                               )}
                               {product.default_rate !== null && product.default_rate > 0 && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ₹{product.default_rate.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-muted-foreground">
                                {[product.hsn_code ? `HSN: ${product.hsn_code}` : null, product.description].filter(Boolean).join(' · ')}
                              </span>
                              <span className={cn("flex items-center gap-1 flex-shrink-0", getPriceAgeColor(product.price_updated_at))}>
                                <Clock className="h-3 w-3" />
                                {getPriceAge(product.price_updated_at)}
                              </span>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {isReadyStock && (
              <div className="rounded-md border border-green-200 bg-green-500/10 px-2 py-1.5 text-xs text-green-700">
                <span className="font-semibold">
                  Ready stock — {lineStock?.qty} available
                </span>
                <span className="ml-1">
                  {premiumApplied
                    ? `${READY_STOCK_PREMIUM_PCT}% premium applied${readyStockBase ? ` (base ${formatCurrency(readyStockBase)})` : ''}.`
                    : `${READY_STOCK_PREMIUM_PCT}% premium ${premiumRate ? `(${formatCurrency(premiumRate)}) ` : ''}not applied — rate edited manually.`}
                </span>
                {(lineStock?.byOffice.length ?? 0) > 0 && (
                  <div className="mt-0.5 text-[11px] opacity-80">
                    {lineStock!.byOffice.map((o) => `${o.officeName}: ${o.qty}`).join(' · ')}
                  </div>
                )}
              </div>
            )}

            {(isObsolete || isDiscontinued) && (
              <div className={cn(
                'rounded-md border px-2 py-1.5 text-xs',
                isObsolete
                  ? 'border-red-200 bg-red-500/10 text-red-700'
                  : 'border-amber-200 bg-amber-500/10 text-amber-700',
              )}>
                <span className="font-semibold">
                  ⚠ {isObsolete ? 'OBSOLETE PRODUCT' : 'DISCONTINUED PRODUCT'}
                </span>
                <span className="ml-1">
                  {isObsolete
                    ? 'This product is marked as obsolete.'
                    : 'This product is no longer actively supplied by the manufacturer.'}
                </span>
                {productLP.replacement_model_no && (
                  <div className="mt-0.5 font-medium">
                    Recommended replacement: {productLP.replacement_model_no}
                  </div>
                )}
              </div>
            )}

            {marginCheck.belowMinimum && (
              <div className="rounded-md border border-amber-200 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700">
                <span className="font-semibold">⚠ Margin below minimum</span>
                <span className="ml-1">
                  {marginCheck.marginPct}% vs {marginCheck.minPct}% minimum — approval required.
                </span>
              </div>
            )}

            <Textarea
              placeholder="Description"
              value={item.description}
              onChange={(e) => onUpdate(index, 'description', e.target.value)}
              rows={2}
              className="min-h-[40px] resize-y text-sm w-full leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Row 2 — Numeric strip */}
        <div className="ml-10 overflow-x-auto scrollbar-thin">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-9 gap-2 min-w-[520px]">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">HSN</label>
            <Input
              placeholder="HSN"
              value={item.hsn_code || ''}
              onChange={(e) => onUpdate(index, 'hsn_code', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)}
              className="h-9 text-sm text-center"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit</label>
            <Select value={item.unit} onValueChange={(value) => onUpdate(index, 'unit', value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Nos">Nos</SelectItem>
                <SelectItem value="Pcs">Pcs</SelectItem>
                <SelectItem value="Set">Set</SelectItem>
                <SelectItem value="Kg">Kg</SelectItem>
                <SelectItem value="Mtr">Mtr</SelectItem>
                <SelectItem value="Ltr">Ltr</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Rate"
              value={item.rate}
              onChange={(e) => onUpdate(index, 'rate', parseFloat(e.target.value) || 0)}
              className={cn(
                "h-9 text-sm text-right",
                floorApplied && "border-amber-500 focus-visible:ring-amber-500"
              )}
            />
            {internalFloor !== null && (
              <div
                className={cn(
                  "text-[10px] mt-1 leading-tight",
                  floorApplied ? "text-amber-600 font-medium" : "text-muted-foreground"
                )}
                title={`Internal only — will auto-raise to floor on save. LP source: ${productLP.source ?? 'catalog'}`}
              >
                Floor: ₹{internalFloor.toLocaleString('en-IN')}
                {floorApplied && ' ↑'}
              </div>
            )}
            {productLP.price_valid_until && (
              <div className="mt-1">
                <PriceValidityBadge validUntil={productLP.price_valid_until} />
              </div>
            )}
            {priceExpired && (
              <div className="mt-1">
                <RequestRevisePriceButton
                  itemLabel={displayName}
                  productId={item.product_id}
                  validUntil={productLP.price_valid_until}
                  quantity={item.quantity}
                  defaultTargetRate={item.target_rate}
                />
              </div>
            )}

          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Target"
              value={item.target_rate || ''}
              onChange={(e) => onUpdate(index, 'target_rate', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-9 text-sm text-right text-orange-600"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Lead (d)</label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Days"
              value={item.lead_time_days ?? ''}
              onChange={(e) => onUpdate(index, 'lead_time_days', e.target.value ? parseInt(e.target.value) : null)}
              className="h-9 text-sm text-center"
              title={item.lead_time_days ? `${item.lead_time_days} days (${formatLeadTime(item.lead_time_days)})` : 'Lead time in days'}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Disc %</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Disc %"
              value={item.discount_percent}
              onChange={(e) => onUpdate(index, 'discount_percent', parseFloat(e.target.value) || 0)}
              className="h-9 text-sm text-center"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tax %</label>
            <Select
              value={item.tax_percent.toString()}
              onValueChange={(value) => onUpdate(index, 'tax_percent', parseFloat(value))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="12">12%</SelectItem>
                <SelectItem value="18">18%</SelectItem>
                <SelectItem value="28">28%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</label>
            <div className="h-9 flex items-center justify-end px-3 bg-background border rounded-md text-sm font-semibold">
              {formatCurrency(item.amount)}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Add Product Dialog */}
      <ProductDialog
        open={addProductDialogOpen}
        onOpenChange={setAddProductDialogOpen}
        defaultName={searchQuery}
        onProductCreated={handleProductCreated}
      />
    </>
  );
}

