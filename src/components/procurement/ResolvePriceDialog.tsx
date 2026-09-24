import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProductsInfinite } from '@/hooks/useProducts';
import { useUploadEnquiryAttachment } from '@/hooks/useEnquiryAttachments';
import { PriceRequest } from '@/hooks/usePriceRequests';
import { toast } from 'sonner';
import { requireTenantId } from '@/utils/tenantUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Package, User, Building2, Loader2, Check, ChevronsUpDown, X, Search, Target, TrendingUp, TrendingDown, AlertTriangle, Plus, Clock, History, Paperclip, Upload } from 'lucide-react';
import { EnquiryAttachmentList } from '@/components/leads/EnquiryAttachmentList';
import { EnquiryAttachmentUpload } from '@/components/leads/EnquiryAttachmentUpload';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface ResolvePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceRequest: PriceRequest | null;
}

export function ResolvePriceDialog({ open, onOpenChange, priceRequest }: ResolvePriceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  
  // Product search with debounce
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const productListRef = useRef<HTMLDivElement>(null);
  
  // Infinite scroll for products
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingProducts,
  } = useProductsInfinite(debouncedProductSearch, 100);
  
  // Flatten products from infinite query
  const products = productsData?.pages.flatMap(page => page.products) || [];
  
  const [supplierId, setSupplierId] = useState('');
  const [matchedProductId, setMatchedProductId] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveAsNoPrice, setResolveAsNoPrice] = useState(false);
  const [createNewProduct, setCreateNewProduct] = useState(false);
  
  // Combobox state
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  
  // Procurement attachment upload state
  const [procurementFiles, setProcurementFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const uploadAttachment = useUploadEnquiryAttachment();

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Reset form when dialog opens/closes or request changes
  useEffect(() => {
    if (open && priceRequest) {
      setSupplierId('');
      setMatchedProductId('');
      setPrice('');
      setNotes('');
      setResolveAsNoPrice(false);
      setCreateNewProduct(false);
      setSupplierOpen(false);
      setProductOpen(false);
      setProductSearch('');
      setDebouncedProductSearch('');
      setProcurementFiles([]);
    }
  }, [open, priceRequest]);

  // Infinite scroll handler
  const handleProductScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrolledToBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 40;
    if (scrolledToBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const selectedProduct = products.find(p => p.id === matchedProductId);

  // Auto-fill price when product is selected (if it has a rate)
  const handleProductSelect = (productId: string) => {
    setMatchedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product?.default_rate && !price) {
      setPrice(product.default_rate.toString());
    }
    setProductOpen(false);
    setProductSearch('');
    setCreateNewProduct(false);
  };

  const handleResolve = async () => {
    if (!priceRequest || !user) return;

    // Require price for resolution (unless marking as no price)
    if (!resolveAsNoPrice && !price) {
      toast.error('Please enter a price');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload procurement attachments first if any
      if (procurementFiles.length > 0 && priceRequest.enquiry_item_id && priceRequest.lead_id) {
        setIsUploadingFiles(true);
        for (const file of procurementFiles) {
          await uploadAttachment.mutateAsync({
            file,
            enquiryItemId: priceRequest.enquiry_item_id,
            leadId: priceRequest.lead_id,
          });
        }
        setIsUploadingFiles(false);
      }
      const resolvedPrice = price ? parseFloat(price) : null;
      const now = new Date().toISOString();
      let finalMatchedProductId = matchedProductId && matchedProductId !== 'none' ? matchedProductId : null;

      // If creating a new product, create it first
      if (createNewProduct && resolvedPrice && priceRequest.enquiry_item?.product_query_text) {
        const tenantId = await requireTenantId();
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            name: priceRequest.enquiry_item.product_query_text,
            default_rate: resolvedPrice,
            purchase_price: resolvedPrice,
            preferred_supplier_id: supplierId || null,
            price_updated_at: now,
            price_updated_by: user.id,
            is_active: true,
            tenant_id: tenantId,
          } as any)
          .select()
          .single();

        if (createError) throw createError;
        
        finalMatchedProductId = newProduct.id;
        toast.success('New product created in catalog');
      }
      // If matching to existing product, update its price
      else if (finalMatchedProductId && resolvedPrice) {
        const { error: updateProductError } = await supabase
          .from('products')
          .update({
            default_rate: resolvedPrice,
            purchase_price: resolvedPrice,
            preferred_supplier_id: supplierId || null,
            price_updated_at: now,
            price_updated_by: user.id,
          })
          .eq('id', finalMatchedProductId);

        if (updateProductError) {
          console.error('Failed to update product price:', updateProductError);
          // Continue anyway - the main resolution should still work
        }
      }

      // 1. Update price_requests table
      const { error: prError } = await supabase
        .from('price_requests')
        .update({
          status: resolveAsNoPrice ? 'no_price' : 'resolved',
          resolved_at: now,
          resolved_by: user.id,
          resolved_price: resolvedPrice,
          supplier_id: supplierId || null,
          notes: notes || null,
        })
        .eq('id', priceRequest.id);

      if (prError) throw prError;

      // 2. Update enquiry_items table with the procurement price
      if (priceRequest.enquiry_item_id) {
        const { error: eiError } = await supabase
          .from('enquiry_items')
          .update({
            price_available: !resolveAsNoPrice,
            price_resolved_at: now,
            price_resolved_by: user.id,
            supplier_id: supplierId || null,
            matched_product_id: finalMatchedProductId,
            procurement_price: resolvedPrice, // Store the resolved price directly
          })
          .eq('id', priceRequest.enquiry_item_id);

        if (eiError) throw eiError;
      }

      // 3. Update lead's enquiry_status based on all items
      if (priceRequest.lead_id) {
        const { data: allItems } = await supabase
          .from('enquiry_items')
          .select('id, price_available, price_flagged_to_procurement_at')
          .eq('lead_id', priceRequest.lead_id);

        if (allItems && allItems.length > 0) {
          const totalItems = allItems.length;
          const resolvedItems = allItems.filter(item => item.price_available === true).length;
          const flaggedItems = allItems.filter(item => item.price_flagged_to_procurement_at !== null).length;

          let newStatus: 'pending_prices' | 'partial_prices' | 'ready_to_quote' = 'pending_prices';
          if (resolvedItems === totalItems) {
            newStatus = 'ready_to_quote';
          } else if (resolvedItems > 0) {
            newStatus = 'partial_prices';
          } else if (flaggedItems > 0) {
            newStatus = 'pending_prices';
          }

          await supabase
            .from('leads')
            .update({ enquiry_status: newStatus })
            .eq('id', priceRequest.lead_id);
        }
      }

      // 4. Send notification to the sales person who requested
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: priceRequest.requested_by,
          title: resolveAsNoPrice ? 'Price Not Available' : 'Price Available',
          message: resolveAsNoPrice 
            ? `Price could not be found for "${priceRequest.enquiry_item?.product_query_text || 'requested item'}"`
            : `Price is now available for "${priceRequest.enquiry_item?.product_query_text || 'requested item'}" - ₹${resolvedPrice?.toLocaleString() || 'N/A'}. You can now generate a quotation.`,
          type: 'price_resolved',
          link: `/leads/${priceRequest.lead_id}`,
        });

      if (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['price-requests'] });
      queryClient.invalidateQueries({ queryKey: ['price-requests-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', priceRequest.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead', priceRequest.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-queue'] });

      toast.success(resolveAsNoPrice ? 'Marked as no price available' : 'Price resolved successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error resolving price:', error);
      toast.error('Failed to resolve price: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!priceRequest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resolve Price Request
          </DialogTitle>
          <DialogDescription>
            Provide the pricing information for this item to enable the sales team to create a quotation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
          <div className="space-y-4 py-4">
          {/* Request Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium">{priceRequest.enquiry_item?.product_query_text}</div>
                <div className="text-sm text-muted-foreground">
                  Lead: {priceRequest.lead?.title || 'Unknown'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{priceRequest.lead?.customer?.company_name || 'Unknown Customer'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Requested by: {priceRequest.requested_by_profile?.full_name || 'Unknown'}</span>
            </div>
          </div>

          {/* Attachments from Sales */}
          {priceRequest.enquiry_item_id && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments from Sales
              </Label>
              <div className="rounded-lg border bg-muted/30 p-3 max-h-[200px] overflow-y-auto">
                <EnquiryAttachmentList 
                  enquiryItemId={priceRequest.enquiry_item_id} 
                  showDelete={false} 
                />
              </div>
            </div>
          )}

          {/* Procurement Attachments Upload */}
          {priceRequest.enquiry_item_id && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Attach Supplier Quote / Documents
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload supplier quotes, price confirmations, or other supporting documents
              </p>
              <EnquiryAttachmentUpload
                files={procurementFiles}
                onFilesChange={setProcurementFiles}
                maxFiles={5}
                disabled={isSubmitting || isUploadingFiles}
              />
            </div>
          )}

          {/* Customer's Expected Price - Prominent Display */}
          {(priceRequest.target_rate !== null && priceRequest.target_rate !== undefined) && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-amber-800 dark:text-amber-300">Customer's Expected Price</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  ₹{priceRequest.target_rate.toLocaleString()}
                </span>
                {priceRequest.enquiry_item?.quantity && (
                  <span className="text-sm text-amber-600 dark:text-amber-500">
                    × {priceRequest.enquiry_item.quantity} qty
                  </span>
                )}
              </div>
              {priceRequest.quoted_rate && (
                <div className="text-sm text-muted-foreground">
                  Quoted rate: ₹{priceRequest.quoted_rate.toLocaleString()}
                </div>
              )}
              <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                Procurement price should be below this for margin
              </div>
            </div>
          )}

          {/* Price Gap Indicator (shown when entering price) */}
          {price && priceRequest.target_rate && (
            <div className={cn(
              "rounded-lg p-3 flex items-center gap-2",
              parseFloat(price) <= priceRequest.target_rate 
                ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
            )}>
              {parseFloat(price) <= priceRequest.target_rate ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                    Margin achievable! ₹{(priceRequest.target_rate - parseFloat(price)).toLocaleString()} below target
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                    ₹{(parseFloat(price) - priceRequest.target_rate).toLocaleString()} above customer's expected price
                  </span>
                </>
              )}
            </div>
          )}

          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedSupplier ? selectedSupplier.name : "Search suppliers..."}
                  <div className="flex items-center gap-1">
                    {supplierId && (
                      <X
                        className="h-4 w-4 opacity-50 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSupplierId('');
                        }}
                      />
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Search suppliers..."
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>No supplier found.</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.name}
                          onSelect={() => {
                            setSupplierId(supplier.id);
                            setSupplierOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              supplierId === supplier.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {supplier.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Match to Product or Create New */}
          <div className="space-y-2">
            <Label>Match to Product</Label>
            {!createNewProduct ? (
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedProduct 
                      ? `${selectedProduct.name}${selectedProduct.default_rate ? ` - ₹${selectedProduct.default_rate}` : ''}`
                      : "Search products..."}
                    <div className="flex items-center gap-1">
                      {matchedProductId && (
                        <X
                          className="h-4 w-4 opacity-50 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMatchedProductId('');
                          }}
                        />
                      )}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[--radix-popover-trigger-width] min-w-[400px] p-0" 
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command shouldFilter={false}>
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                    </div>
                    <CommandList 
                      ref={productListRef}
                      className="max-h-[280px] overflow-y-auto overscroll-contain"
                      onScroll={handleProductScroll}
                    >
                      {isLoadingProducts ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                          Loading products...
                        </div>
                      ) : products.length === 0 ? (
                        <div className="py-4 px-3 text-center">
                          <p className="text-sm text-muted-foreground mb-3">No product found in catalog</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCreateNewProduct(true);
                              setProductOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Create New Product
                          </Button>
                        </div>
                      ) : (
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => handleProductSelect(product.id)}
                              className="cursor-pointer flex-col items-start py-2"
                            >
                              <div className="flex items-center w-full">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 flex-shrink-0",
                                    matchedProductId === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="truncate font-medium">
                                  {product.name} {product.default_rate ? `- ₹${product.default_rate}` : ''}
                                </span>
                              </div>
                              {product.price_updated_at && (
                                <div className="ml-6 text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  Updated {formatDistanceToNow(new Date(product.price_updated_at), { addSuffix: true })}
                                </div>
                              )}
                            </CommandItem>
                          ))}
                          {isFetchingNextPage && (
                            <div className="py-2 text-center text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            </div>
                          )}
                          {!hasNextPage && products.length > 0 && (
                            <div className="py-2 text-center text-xs text-muted-foreground">
                              End of results
                            </div>
                          )}
                        </CommandGroup>
                      )}
                    </CommandList>
                    {products.length > 0 && (
                      <div className="border-t p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCreateNewProduct(true);
                            setProductOpen(false);
                          }}
                          className="w-full gap-2 text-muted-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Create New Product Instead
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="rounded-lg border p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      Creating new product: "{priceRequest.enquiry_item?.product_query_text}"
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCreateNewProduct(false)}
                    className="h-6 px-2"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A new product will be created in the catalog with the price you enter below
                </p>
              </div>
            )}
            
            {/* Price History Info - Show when product is selected */}
            {selectedProduct && !createNewProduct && (
              <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Price History
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="ml-2 font-medium">
                      {selectedProduct.default_rate ? `₹${selectedProduct.default_rate.toLocaleString()}` : 'Not set'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Purchase Price:</span>
                    <span className="ml-2 font-medium">
                      {selectedProduct.purchase_price ? `₹${selectedProduct.purchase_price.toLocaleString()}` : 'Not set'}
                    </span>
                  </div>
                </div>
                {selectedProduct.price_updated_at ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t">
                    <Clock className="h-3 w-3" />
                    Last updated {format(new Date(selectedProduct.price_updated_at), 'dd MMM yyyy, hh:mm a')}
                    {' '}({formatDistanceToNow(new Date(selectedProduct.price_updated_at), { addSuffix: true })})
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t">
                    <AlertTriangle className="h-3 w-3" />
                    Price never updated - no history available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">
              Price (₹) {!resolveAsNoPrice && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="price"
              type="number"
              placeholder="Enter the price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {(createNewProduct || matchedProductId) && price && (
              <p className="text-xs text-muted-foreground">
                This price will be saved to the product catalog
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about the pricing..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              setResolveAsNoPrice(true);
              handleResolve();
            }}
            disabled={isSubmitting}
            className="text-destructive hover:text-destructive"
          >
            Mark as No Price
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={isSubmitting || isUploadingFiles || (!resolveAsNoPrice && !price)}>
            {(isSubmitting || isUploadingFiles) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploadingFiles ? 'Uploading...' : createNewProduct ? 'Create & Resolve' : 'Resolve Price'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
