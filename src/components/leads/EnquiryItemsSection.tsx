import { useState, useMemo, useCallback } from 'react';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import { Plus, Package, Clock, CheckCircle, AlertCircle, Flag, Trash2, FileText, Link2, RefreshCw, DollarSign, Sparkles, Search, Wand2, Pencil, Paperclip, History as HistoryIcon, Target as TargetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useEnquiryItems,
  useCreateEnquiryItem,
  useDeleteEnquiryItem,
  useUpdateEnquiryItem,
  useFlagToProcurement,
  useLinkEnquiryToProduct,
  type EnquiryItem,
} from '@/hooks/useEnquiryItems';
import { useProductMatches, type ProductMatch } from '@/hooks/useProductMatch';
import { useCreatePriceRequest } from '@/hooks/usePriceRequests';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ProductSearchCombobox } from './ProductSearchCombobox';
import { BrandCombobox } from '@/components/enquiries/BrandCombobox';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RequestPriceDialog } from './RequestPriceDialog';
import { EnquiryAttachmentUpload } from './EnquiryAttachmentUpload';
import { EnquiryAttachmentList } from './EnquiryAttachmentList';
import { useEnquiryAttachmentCounts, useUploadEnquiryAttachment } from '@/hooks/useEnquiryAttachments';
import { useEnquiryPriceRequests } from '@/hooks/useEnquiryPriceRequests';
import { useRequestRevision } from '@/hooks/usePriceRequestQuotes';
import { PriceThreadSheet } from './PriceThreadSheet';

interface EnquiryItemsSectionProps {
  leadId: string;
  customerId?: string;
  customerName?: string;
  onGenerateQuotation?: (items: EnquiryItem[]) => void;
}

interface SelectedProduct {
  id: string;
  name: string;
  hsn_code: string | null;
  default_rate: number | null;
  purchase_price: number | null;
  unit: string | null;
  tax_rate: number | null;
  brand?: string | null;
}

export function EnquiryItemsSection({ 
  leadId, 
  customerId,
  customerName,
  onGenerateQuotation 
}: EnquiryItemsSectionProps) {
  const { user } = useAuth();
  const { data: items, isLoading } = useEnquiryItems(leadId);
  const createItem = useCreateEnquiryItem();
  const deleteItem = useDeleteEnquiryItem();
  const updateItem = useUpdateEnquiryItem();
  const flagToProcurement = useFlagToProcurement();
  const linkToProduct = useLinkEnquiryToProduct();
  const createPriceRequest = useCreatePriceRequest();
  const requestRevision = useRequestRevision();
  const { data: priceRequestsByItem, refetch: refetchPriceRequests } = useEnquiryPriceRequests(leadId);
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadItem, setThreadItem] = useState<EnquiryItem | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [priceRequestDialogOpen, setPriceRequestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemForLink, setSelectedItemForLink] = useState<EnquiryItem | null>(null);
  const [selectedItemForPriceRequest, setSelectedItemForPriceRequest] = useState<EnquiryItem | null>(null);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<EnquiryItem | null>(null);
  const [isRepriceRequest, setIsRepriceRequest] = useState(false);
  
  // Add item form state
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [customItemText, setCustomItemText] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [inputMode, setInputMode] = useState<'catalog' | 'custom'>('catalog');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  // Attachment dialogs
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedItemForAttachment, setSelectedItemForAttachment] = useState<EnquiryItem | null>(null);
  
  // Attachment hooks
  const uploadAttachment = useUploadEnquiryAttachment();
  
  // Get attachment counts for all items
  const enquiryItemIds = useMemo(() => items?.map(item => item.id) || [], [items]);
  const { data: attachmentCounts } = useEnquiryAttachmentCounts(enquiryItemIds);

  // Edit item form state
  const [editQueryText, setEditQueryText] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editNotes, setEditNotes] = useState('');
  const [editBrand, setEditBrand] = useState('');

  // Get search terms for unlinked enquiry items (to check if they exist in catalog)
  const unlinkedSearchTerms = useMemo(() => {
    if (!items) return [];
    return items
      .filter(item => !item.matched_product_id)
      .map(item => item.product_query_text);
  }, [items]);

  // Get potential matches from catalog for unlinked items
  const { data: potentialMatches } = useProductMatches(unlinkedSearchTerms);

  // Calculate items that can be added to quotation (have prices)
  const quotableItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      // Item has procurement price from resolved price request
      if (item.procurement_price && item.procurement_price > 0) {
        return true;
      }
      // Item has a matched product with a price
      if (item.matched_product?.default_rate && item.matched_product.default_rate > 0) {
        return true;
      }
      // Item was resolved by procurement (price_available) - check if matched product has price now
      if (item.price_available && item.matched_product?.default_rate && item.matched_product.default_rate > 0) {
        return true;
      }
      // Check if there's a potential match with price in catalog
      if (!item.matched_product_id && potentialMatches) {
        const matches = potentialMatches[item.product_query_text];
        if (matches?.length > 0 && matches[0].default_rate && matches[0].default_rate > 0) {
          return true;
        }
      }
      return false;
    });
  }, [items, potentialMatches]);

  const resetAddForm = () => {
    setSelectedProduct(null);
    setCustomItemText('');
    setNewItemQuantity('1');
    setNewItemBrand('');
    setInputMode('catalog');
    setPendingFiles([]);
  };

  const handleProductSelect = (product: SelectedProduct | null, customText?: string) => {
    if (product) {
      setSelectedProduct(product);
      setCustomItemText('');
      setInputMode('catalog');
      // Auto-fill brand from catalog product (user can override)
      if (product.brand && !newItemBrand.trim()) {
        setNewItemBrand(product.brand);
      }
    } else if (customText) {
      setSelectedProduct(null);
      setCustomItemText(customText);
      setInputMode('custom');
    }
  };

  const handleAddItem = async () => {
    if (!selectedProduct && !customItemText.trim()) {
      toast.error('Please select a product or enter a description');
      return;
    }

    const productQueryText = selectedProduct?.name || customItemText;
    const matchedProductId = selectedProduct?.id || null;
    const hasPriceInCatalog = selectedProduct?.default_rate && selectedProduct.default_rate > 0;
    // Require brand for free-text items (no catalog match)
    if (!matchedProductId && !newItemBrand.trim()) {
      toast.error('Please select a Make / Brand for this custom item so it routes correctly');
      return;
    }

    const newItem = await createItem.mutateAsync({
      lead_id: leadId,
      product_query_text: productQueryText,
      quantity: parseFloat(newItemQuantity) || 1,
      matched_product_id: matchedProductId,
      price_available: hasPriceInCatalog || false,
      brand: newItemBrand.trim() || selectedProduct?.brand || null,
    });

    // Upload any pending files
    if (pendingFiles.length > 0 && newItem?.id) {
      for (const file of pendingFiles) {
        try {
          await uploadAttachment.mutateAsync({
            file,
            enquiryItemId: newItem.id,
            leadId,
          });
        } catch (err) {
          console.error('Failed to upload file:', file.name, err);
        }
      }
    }

    resetAddForm();
    setAddDialogOpen(false);

    if (hasPriceInCatalog) {
      toast.success('Item added with catalog price');
    } else if (matchedProductId) {
      toast.success('Item added - product found but no rate set');
    } else {
      toast.success('Custom item added - pricing needed');
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItemId) return;
    await deleteItem.mutateAsync({ id: selectedItemId, leadId });
    setSelectedItemId(null);
    setDeleteDialogOpen(false);
  };

  const handleOpenEditDialog = (item: EnquiryItem) => {
    setSelectedItemForEdit(item);
    setEditQueryText(item.product_query_text);
    setEditQuantity(String(item.quantity || 1));
    setEditNotes(item.notes || '');
    setEditBrand((item as any).brand || '');
    setEditDialogOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!selectedItemForEdit || !editQueryText.trim()) return;
    await updateItem.mutateAsync({
      id: selectedItemForEdit.id,
      leadId,
      product_query_text: editQueryText.trim(),
      quantity: parseFloat(editQuantity) || 1,
      notes: editNotes || null,
      brand: editBrand.trim() || null,
    });
    setEditDialogOpen(false);
    setSelectedItemForEdit(null);
  };

  const handleOpenPriceRequestDialog = (item: EnquiryItem, isReprice: boolean = false) => {
    setSelectedItemForPriceRequest(item);
    setIsRepriceRequest(isReprice);
    setPriceRequestDialogOpen(true);
  };

  const handleSubmitPriceRequest = async (data: { targetRate?: number; priority: string; notes?: string }) => {
    if (!user || !selectedItemForPriceRequest) return;

    const existing = priceRequestsByItem?.[selectedItemForPriceRequest.id];

    // A reprice on an item that already has a live price request becomes a
    // negotiation round on that request, routed back to whoever priced it last.
    if (isRepriceRequest && existing && data.targetRate) {
      await requestRevision.mutateAsync({
        request: {
          id: existing.id,
          current_round: existing.current_round,
          last_priced_by: existing.last_priced_by,
        },
        targetPrice: data.targetRate,
        notes: data.notes,
      });
      await refetchPriceRequests();
      setPriceRequestDialogOpen(false);
      setSelectedItemForPriceRequest(null);
      return;
    }

    // First flag the enquiry item
    await flagToProcurement.mutateAsync({ 
      id: selectedItemForPriceRequest.id, 
      leadId, 
      userId: user.id 
    });
    
    // Then create a price request with target rate
    await createPriceRequest.mutateAsync({
      lead_id: leadId,
      enquiry_item_id: selectedItemForPriceRequest.id,
      requested_by: user.id,
      priority: data.priority as 'low' | 'normal' | 'high' | 'urgent',
      notes: data.notes || (isRepriceRequest ? 'Reprice requested' : undefined),
      target_rate: data.targetRate || null,
    });
    await refetchPriceRequests();


    setPriceRequestDialogOpen(false);
    setSelectedItemForPriceRequest(null);
  };

  const handleLinkToProduct = (item: EnquiryItem) => {
    setSelectedItemForLink(item);
    setLinkDialogOpen(true);
  };

  const handleConfirmLink = async (product: SelectedProduct) => {
    if (!selectedItemForLink || !user) return;
    
    await linkToProduct.mutateAsync({
      id: selectedItemForLink.id,
      leadId,
      matchedProductId: product.id,
      priceAvailable: (product.default_rate ?? 0) > 0,
    });
    
    setSelectedItemForLink(null);
    setLinkDialogOpen(false);
  };

  const handleGenerateQuotation = () => {
    if (onGenerateQuotation && quotableItems.length > 0) {
      // Enrich items with potential match data if not already linked
      // Also apply procurement_price as the rate if available
      const enrichedItems = quotableItems.map(item => {
        // Determine the rate to use: procurement_price takes priority, then matched_product.default_rate
        const effectiveRate = item.procurement_price ?? item.matched_product?.default_rate ?? null;
        
        // If already has matched_product with data, use it but override rate with procurement_price if available
        if (item.matched_product?.id) {
          return {
            ...item,
            matched_product: {
              ...item.matched_product,
              default_rate: effectiveRate ?? item.matched_product.default_rate,
            }
          };
        }
        
        // Otherwise, attach potential match as matched_product for quotation
        if (!item.matched_product_id && potentialMatches) {
          const potentialMatch = potentialMatches[item.product_query_text]?.[0];
          if (potentialMatch) {
            return {
              ...item,
              matched_product: {
                id: potentialMatch.id,
                name: potentialMatch.name,
                default_rate: item.procurement_price ?? potentialMatch.default_rate,
                hsn_code: potentialMatch.hsn_code,
                unit: potentialMatch.unit,
                tax_rate: potentialMatch.tax_rate,
              }
            };
          }
        }
        
        // If item has procurement_price but no matched product, create a virtual product for quotation
        if (item.procurement_price && item.procurement_price > 0) {
          return {
            ...item,
            matched_product: {
              id: item.id, // Use enquiry item ID as placeholder
              name: item.product_query_text,
              default_rate: item.procurement_price,
              hsn_code: null,
              unit: 'Nos',
              tax_rate: 18, // Default GST rate
            }
          };
        }
        
        return item;
      });
      
      onGenerateQuotation(enrichedItems);
    }
  };

  // Quick link handler for items that have a potential match
  const handleQuickLink = async (item: EnquiryItem, match: ProductMatch) => {
    if (!user) return;
    
    await linkToProduct.mutateAsync({
      id: item.id,
      leadId,
      matchedProductId: match.id,
      priceAvailable: (match.default_rate ?? 0) > 0,
    });
  };

  // Get all items that have potential matches but are not yet linked
  const itemsWithPotentialMatches = useMemo(() => {
    if (!items || !potentialMatches) return [];
    return items
      .filter(item => !item.matched_product_id)
      .map(item => {
        const match = potentialMatches[item.product_query_text]?.[0];
        return match ? { item, match } : null;
      })
      .filter((entry): entry is { item: EnquiryItem; match: ProductMatch } => entry !== null);
  }, [items, potentialMatches]);

  // Match All handler - links all unlinked items to their best potential match
  const [isMatchingAll, setIsMatchingAll] = useState(false);
  
  const handleMatchAll = useCallback(async () => {
    if (!user || itemsWithPotentialMatches.length === 0) return;
    
    setIsMatchingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const { item, match } of itemsWithPotentialMatches) {
        try {
          await linkToProduct.mutateAsync({
            id: item.id,
            leadId,
            matchedProductId: match.id,
            priceAvailable: (match.default_rate ?? 0) > 0,
          });
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Failed to link item:', item.id, err);
        }
      }
      
      if (successCount > 0 && errorCount === 0) {
        toast.success(`Successfully matched ${successCount} item(s) to catalog`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`Matched ${successCount} item(s), ${errorCount} failed`);
      } else {
        toast.error('Failed to match items');
      }
    } finally {
      setIsMatchingAll(false);
    }
  }, [user, itemsWithPotentialMatches, linkToProduct, leadId]);

  // Get status info for an item (now also checks potential matches and procurement_price)
  const getItemStatus = (item: EnquiryItem, potentialMatch?: ProductMatch | null) => {
    const hasMatchedProduct = !!item.matched_product;
    const hasCatalogPrice = item.matched_product?.default_rate && item.matched_product.default_rate > 0;
    const hasProcurementPrice = item.procurement_price && item.procurement_price > 0;
    const isPriceRequested = !!item.price_flagged_to_procurement_at;
    const isPriceResolved = item.price_available;

    // Determine the effective price (procurement_price takes priority)
    const effectivePrice = item.procurement_price ?? item.matched_product?.default_rate ?? null;

    // Has procurement price resolved
    if (hasProcurementPrice) {
      return {
        type: 'procurement_priced' as const,
        label: 'Price Resolved',
        price: item.procurement_price,
        variant: 'success' as const,
        icon: CheckCircle,
        potentialMatch: null,
      };
    }
    // Already linked and has price
    if (isPriceResolved && hasCatalogPrice) {
      return {
        type: 'catalog_priced' as const,
        label: `In Catalog`,
        price: effectivePrice,
        variant: 'success' as const,
        icon: CheckCircle,
        potentialMatch: null,
      };
    }
    if (isPriceResolved && !hasCatalogPrice) {
      return {
        type: 'resolved' as const,
        label: 'Price Available',
        price: effectivePrice,
        variant: 'success' as const,
        icon: CheckCircle,
        potentialMatch: null,
      };
    }
    if (hasCatalogPrice) {
      return {
        type: 'catalog_priced' as const,
        label: `In Catalog`,
        price: effectivePrice,
        variant: 'success' as const,
        icon: CheckCircle,
        potentialMatch: null,
      };
    }
    if (hasMatchedProduct && !hasCatalogPrice) {
      return {
        type: 'catalog_no_rate' as const,
        label: 'In Catalog - No Rate',
        price: null,
        variant: 'info' as const,
        icon: Package,
        potentialMatch: null,
      };
    }

    // Not linked - check for potential matches in catalog
    if (potentialMatch && potentialMatch.default_rate && potentialMatch.default_rate > 0) {
      return {
        type: 'available_in_catalog' as const,
        label: 'Available in Catalog',
        price: potentialMatch.default_rate,
        variant: 'available' as const,
        icon: Search,
        potentialMatch,
      };
    }
    if (potentialMatch && (!potentialMatch.default_rate || potentialMatch.default_rate === 0)) {
      return {
        type: 'found_no_rate' as const,
        label: 'Found - No Rate',
        price: null,
        variant: 'info' as const,
        icon: Search,
        potentialMatch,
      };
    }

    if (isPriceRequested) {
      return {
        type: 'requested' as const,
        label: 'Price Requested',
        price: null,
        variant: 'warning' as const,
        icon: Clock,
        potentialMatch: null,
      };
    }
    return {
      type: 'not_in_catalog' as const,
      label: 'Not in Catalog',
      price: null,
      variant: 'muted' as const,
      icon: AlertCircle,
      potentialMatch: null,
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enquiry Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Enquiry Items
            {items && items.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {itemsWithPotentialMatches.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleMatchAll}
                      disabled={isMatchingAll}
                      className="border-cyan-500/50 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      {isMatchingAll ? 'Matching...' : 'Match All'}
                      <Badge variant="secondary" className="ml-2 bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
                        {itemsWithPotentialMatches.length}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auto-link {itemsWithPotentialMatches.length} item(s) to catalog matches</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {quotableItems.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={handleGenerateQuotation}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Quotation
                      <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                        {quotableItems.length}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create quotation with {quotableItems.length} priced item(s)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!items?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No enquiry items yet</p>
              <p className="text-sm">Add items from the customer's query to track pricing</p>
            </div>
          ) : (
            <div className="space-y-3">
            {items.map((item) => {
                // Get potential match for unlinked items
                const potentialMatch = !item.matched_product_id && potentialMatches 
                  ? potentialMatches[item.product_query_text]?.[0] || null
                  : null;
                const status = getItemStatus(item, potentialMatch);
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg border border-border/50"
                  >
                  <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.product_query_text}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          Qty: {item.quantity || 1}
                        </span>
                        {/* Display Target Price if set */}
                        {item.target_rate && item.target_rate > 0 && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Target: {formatCurrencyWithSymbol(item.target_rate, 'INR')}
                          </Badge>
                        )}
                        {item.matched_product && (
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {item.matched_product.name}
                          </Badge>
                        )}
                        {/* Show potential match suggestion */}
                        {status.potentialMatch && (
                          <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-700">
                            <Search className="h-3 w-3 mr-1" />
                            Found: {status.potentialMatch.name}
                          </Badge>
                        )}
                        {item.supplier && (
                          <Badge variant="secondary" className="text-xs">
                            {item.supplier.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status Badge */}
                      <Badge
                        variant="outline"
                        className={`text-xs flex items-center gap-1 whitespace-nowrap ${
                          status.variant === 'success'
                            ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
                            : status.variant === 'warning'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                            : status.variant === 'info'
                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                            : status.variant === 'available'
                            ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                        {status.price && (
                          <span className="font-semibold ml-1">
                            {formatCurrencyWithSymbol(status.price, 'INR')}
                          </span>
                        )}
                      </Badge>

                      {status.type === 'procurement_priced' && (
                        <PriceValidityBadge validUntil={item.price_valid_until} showEmpty />
                      )}

                      {priceRequestsByItem?.[item.id] && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setThreadItem(item);
                                  setThreadOpen(true);
                                }}
                              >
                                <HistoryIcon className="h-3 w-3" />
                                {(priceRequestsByItem[item.id].current_round || 1) > 1 && (
                                  <span className="ml-1 text-[10px]">
                                    R{priceRequestsByItem[item.id].current_round}
                                  </span>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Price thread & negotiation rounds</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}


                      {/* Action Buttons based on status */}
                      {status.type === 'catalog_priced' && (
                        <>
                          {/* Show "Request Better Price" if target rate exists and is lower than catalog price */}
                          {item.target_rate && item.target_rate > 0 && status.price && item.target_rate < status.price && !item.price_flagged_to_procurement_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                                    onClick={() => handleOpenPriceRequestDialog(item, true)}
                                    disabled={flagToProcurement.isPending}
                                  >
                                    <Flag className="h-3 w-3 mr-1" />
                                    Better Price
                                    <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                                      -{Math.round(((status.price - item.target_rate) / status.price) * 100)}%
                                    </Badge>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Customer target: {formatCurrencyWithSymbol(item.target_rate, 'INR')}</p>
                                  <p>Catalog price: {formatCurrencyWithSymbol(status.price, 'INR')}</p>
                                  <p>Gap: {formatCurrencyWithSymbol(status.price - item.target_rate, 'INR')} ({Math.round(((status.price - item.target_rate) / status.price) * 100)}% lower)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenPriceRequestDialog(item, true)}
                                  disabled={flagToProcurement.isPending}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Request Reprice</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}

                      {status.type === 'catalog_no_rate' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPriceRequestDialog(item)}
                          disabled={flagToProcurement.isPending}
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Request Price
                        </Button>
                      )}

                      {/* Available in Catalog - Show "Link Now" button */}
                      {(status.type === 'available_in_catalog' || status.type === 'found_no_rate') && status.potentialMatch && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-cyan-600 hover:bg-cyan-700"
                            onClick={() => handleQuickLink(item, status.potentialMatch!)}
                            disabled={linkToProduct.isPending}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link Now
                          </Button>
                          {status.type === 'found_no_rate' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPriceRequestDialog(item)}
                              disabled={flagToProcurement.isPending}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Request Price
                            </Button>
                          )}
                        </div>
                      )}

                      {status.type === 'not_in_catalog' && !item.price_flagged_to_procurement_at && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLinkToProduct(item)}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPriceRequestDialog(item)}
                            disabled={flagToProcurement.isPending}
                          >
                            <Flag className="h-3 w-3 mr-1" />
                            Request Price
                          </Button>
                        </div>
                      )}

                      {/* Sales can always ask for a target price or a revision */}
                      {(() => {
                        const expired =
                          !!item.price_valid_until &&
                          new Date(item.price_valid_until).getTime() <
                            new Date(new Date().toDateString()).getTime();
                        const hasRequest = !!priceRequestsByItem?.[item.id];
                        return (
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenPriceRequestDialog(item, hasRequest)}
                                    disabled={flagToProcurement.isPending}
                                  >
                                    <TargetIcon className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ask target price</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {expired ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() => handleOpenPriceRequestDialog(item, true)}
                                disabled={flagToProcurement.isPending}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Price expired — request fresh price
                              </Button>
                            ) : (
                              status.type !== 'catalog_priced' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleOpenPriceRequestDialog(item, true)}
                                        disabled={flagToProcurement.isPending}
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Request reprice</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )
                            )}
                          </div>
                        );
                      })()}

                      {/* Attachments Button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 relative"
                              onClick={() => {
                                setSelectedItemForAttachment(item);
                                setAttachmentDialogOpen(true);
                              }}
                            >
                              <Paperclip className="h-4 w-4" />
                              {attachmentCounts && attachmentCounts[item.id] > 0 && (
                                <Badge 
                                  variant="secondary" 
                                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                                >
                                  {attachmentCounts[item.id]}
                                </Badge>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {attachmentCounts && attachmentCounts[item.id] > 0 
                              ? `${attachmentCounts[item.id]} attachment(s)` 
                              : 'Add attachments'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleOpenEditDialog(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Enquiry Item</DialogTitle>
            <DialogDescription>
              Search the product catalog or add a custom item
            </DialogDescription>
          </DialogHeader>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'catalog' | 'custom')}>
            <TabsList className="w-full">
              <TabsTrigger value="catalog" className="flex-1">
                <Package className="h-4 w-4 mr-2" />
                Search Catalog
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Custom Item
              </TabsTrigger>
            </TabsList>
            <TabsContent value="catalog" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Search Product</Label>
                <ProductSearchCombobox
                  onSelect={handleProductSelect}
                  placeholder="Search by name or code..."
                />
              </div>
              {selectedProduct && (
                <div className="p-3 bg-muted rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{selectedProduct.name}</p>
                      {selectedProduct.hsn_code && (
                        <p className="text-xs text-muted-foreground">HSN: {selectedProduct.hsn_code}</p>
                      )}
                    </div>
                    {selectedProduct.default_rate && selectedProduct.default_rate > 0 ? (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                        {formatCurrencyWithSymbol(selectedProduct.default_rate, 'INR')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No Rate</Badge>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="product-text">Product Description</Label>
                <Textarea
                  id="product-text"
                  placeholder="Enter product name or description..."
                  value={customItemText}
                  onChange={(e) => {
                    setCustomItemText(e.target.value);
                    setSelectedProduct(null);
                  }}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Custom items will need pricing from procurement
                </p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Make / Brand{!selectedProduct && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <BrandCombobox
              value={newItemBrand}
              onChange={setNewItemBrand}
              required={!selectedProduct}
              placeholder="Select brand (e.g. Siemens, ABB)…"
            />
          </div>
          <div className="space-y-2">
            <Label>Attachments (Optional)</Label>
            <EnquiryAttachmentUpload
              files={pendingFiles}
              onFilesChange={setPendingFiles}
              maxFiles={5}
              disabled={createItem.isPending || uploadAttachment.isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem} 
              disabled={createItem.isPending || (!selectedProduct && !customItemText.trim())}
            >
              {selectedProduct?.default_rate && selectedProduct.default_rate > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Add with Price
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Product Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => {
        setLinkDialogOpen(open);
        if (!open) setSelectedItemForLink(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Catalog Product</DialogTitle>
            <DialogDescription>
              Find a matching product for "{selectedItemForLink?.product_query_text}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ProductSearchCombobox
              onSelect={(product) => {
                if (product) {
                  handleConfirmLink(product);
                }
              }}
              placeholder="Search for matching product..."
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Enquiry Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this enquiry item. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setSelectedItemForEdit(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Enquiry Item</DialogTitle>
            <DialogDescription>
              Update details for "{selectedItemForEdit?.product_query_text}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-query-text">Product Description</Label>
              <Textarea
                id="edit-query-text"
                placeholder="Enter product name or description..."
                value={editQueryText}
                onChange={(e) => setEditQueryText(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Make / Brand</Label>
              <BrandCombobox
                value={editBrand}
                onChange={setEditBrand}
                placeholder="Select brand…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Add notes about this item..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateItem}
              disabled={updateItem.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Price Dialog */}
      <RequestPriceDialog
        open={priceRequestDialogOpen}
        onOpenChange={setPriceRequestDialogOpen}
        item={selectedItemForPriceRequest}
        onSubmit={handleSubmitPriceRequest}
        isSubmitting={createPriceRequest.isPending || flagToProcurement.isPending || requestRevision.isPending}
        isReprice={isRepriceRequest}
        defaultTargetRate={selectedItemForPriceRequest?.target_rate}
      />

      <PriceThreadSheet
        open={threadOpen}
        onOpenChange={setThreadOpen}
        itemName={threadItem?.product_query_text}
        request={threadItem ? priceRequestsByItem?.[threadItem.id] ?? null : null}
        onRequestReprice={() => {
          if (!threadItem) return;
          setThreadOpen(false);
          handleOpenPriceRequestDialog(threadItem, true);
        }}
      />



      {/* Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={(open) => {
        setAttachmentDialogOpen(open);
        if (!open) setSelectedItemForAttachment(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </DialogTitle>
            <DialogDescription>
              {selectedItemForAttachment?.product_query_text}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedItemForAttachment && (
              <>
                <EnquiryAttachmentList 
                  enquiryItemId={selectedItemForAttachment.id} 
                  showDelete={true}
                />
                <div className="border-t pt-4">
                  <Label className="mb-2 block">Add More Attachments</Label>
                  <EnquiryAttachmentUpload
                    files={pendingFiles}
                    onFilesChange={setPendingFiles}
                    maxFiles={5}
                    disabled={uploadAttachment.isPending}
                  />
                  {pendingFiles.length > 0 && (
                    <Button
                      className="mt-3 w-full"
                      onClick={async () => {
                        if (!selectedItemForAttachment) return;
                        for (const file of pendingFiles) {
                          await uploadAttachment.mutateAsync({
                            file,
                            enquiryItemId: selectedItemForAttachment.id,
                            leadId,
                          });
                        }
                        setPendingFiles([]);
                        toast.success('Attachments uploaded');
                      }}
                      disabled={uploadAttachment.isPending}
                    >
                      {uploadAttachment.isPending ? 'Uploading...' : `Upload ${pendingFiles.length} file(s)`}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
