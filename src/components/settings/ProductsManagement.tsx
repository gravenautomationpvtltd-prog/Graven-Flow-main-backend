import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Package, Plus, Search, MoreHorizontal, Pencil, Trash2, FileSpreadsheet, Upload, Clock, ExternalLink, Copy, Warehouse } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductsAdmin, useDeleteProduct, type ProductWithUpdater } from '@/hooks/useProducts';
import { ProductDialog } from './ProductDialog';
import { BulkImportDialog } from './BulkImportDialog';
import { ListPriceUploadDialog } from './ListPriceUploadDialog';
import { ImportProductsDialog } from '@/components/products/ImportProductsDialog';
import { ModelDuplicatesDialog } from '@/components/products/ModelDuplicatesDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getPriceAge, getPriceAgeColor } from '@/lib/price-age-utils';
import { computePricing, quoteEligibility, PRODUCT_STATUS_LABEL } from '@/lib/pricing';
import { Link } from 'react-router-dom';
import type { Product } from '@/hooks/useQuotations';
import { useReadyStockMap } from '@/hooks/useReadyStock';
import { ProductStockDialog } from '@/components/inventory/ProductStockDialog';
import { applyReadyStockPremium, READY_STOCK_PREMIUM_PCT } from '@/lib/ready-stock';
import { Checkbox } from '@/components/ui/checkbox';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useBulkDelete } from '@/hooks/useBulkActions';
import { useProfiles } from '@/hooks/useProfiles';
import { useBIETeam } from '@/hooks/useBIEWork';
import { AssignProductWorkDialog } from '@/components/products/AssignProductWorkDialog';
import { ProductBulkEditDialog } from '@/components/products/ProductBulkEditDialog';
import { UserPlus, ListChecks, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ITEMS_PER_PAGE = 500;

export function ProductsManagement() {
  const { isAdmin, isProcurement, isManager, isPureBIE, isBIE, isWarehouse, isAccounts, user } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'discontinued' | 'obsolete'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [listPriceOpen, setListPriceOpen] = useState(false);
  const [activeImportOpen, setActiveImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [readyStockOnly, setReadyStockOnly] = useState(false);
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductWithUpdater | null>(null);
  const [createdByFilter, setCreatedByFilter] = useState('all');
  const [updatedByFilter, setUpdatedByFilter] = useState('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const canSeeUpdater = isAdmin || isProcurement;
  const canBulkDelete = isAdmin || isManager || isProcurement || isBIE;
  const canEditProducts = isAdmin || isManager || isProcurement || isBIE;
  const canManageStock = isAdmin || isManager || isProcurement || isWarehouse || isAccounts;
  const { data: allProfiles = [] } = useProfiles();
  const { data: bieTeam = [] } = useBIETeam();
  const people = isPureBIE ? bieTeam : allProfiles;
  const bulkDelete = useBulkDelete();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Server-side pagination and search
  const { data, isLoading } = useProductsAdmin(
    currentPage,
    ITEMS_PER_PAGE,
    debouncedSearch,
    statusFilter,
    createdByFilter,
    updatedByFilter,
  );
  const allProducts = data?.products ?? [];
  const { data: stockMap } = useReadyStockMap(allProducts.map((p) => p.id));
  const products = readyStockOnly
    ? allProducts.filter((p) => (stockMap?.get(p.id)?.qty ?? 0) > 0)
    : allProducts;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const deleteProductMutation = useDeleteProduct();

  const selection = useBulkSelection({ items: products, getItemId: (p) => p.id });
  const selectedIds = Array.from(selection.selectedIds);

  const personName = (id?: string | null, embedded?: { full_name: string } | null) => {
    if (embedded?.full_name) return embedded.full_name;
    if (!id) return null;
    return people.find((p) => p.id === id)?.full_name ?? null;
  };

  const timeAgo = (value?: string | null) => {
    if (!value) return null;
    try {
      return formatDistanceToNow(new Date(value), { addSuffix: true });
    } catch {
      return null;
    }
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync({ table: 'products', ids: selectedIds, entityType: 'product' });
    selection.deselectAll();
    setBulkDeleteOpen(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateMargin = (sellingPrice: number | null, purchasePrice: number | null) => {
    if (!sellingPrice || !purchasePrice || purchasePrice === 0) return null;
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  };

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteProduct) {
      await deleteProductMutation.mutateAsync(deleteProduct.id);
      setDeleteProduct(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditProduct(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Product Catalog</CardTitle>
                <CardDescription>
                  Manage products with HSN codes, pricing, and profit margins
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button variant="outline" onClick={() => setActiveImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Active Products & Prices
              </Button>
              <Button variant="outline" onClick={() => setLegacyImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Discontinued / Obsolete
              </Button>
              <Button variant="outline" onClick={() => setListPriceOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import List Prices
              </Button>
              <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
              <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Check
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search model no, brand or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as typeof statusFilter);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
                <SelectItem value="obsolete">Obsolete</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={readyStockOnly ? 'default' : 'outline'}
              onClick={() => setReadyStockOnly((v) => !v)}
            >
              <Warehouse className="h-4 w-4 mr-2" />
              Ready stock only
            </Button>
            <Select
              value={createdByFilter}
              onValueChange={(v) => {
                setCreatedByFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Added by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Added by: anyone</SelectItem>
                {user && <SelectItem value={user.id}>Added by: me</SelectItem>}
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name || person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={updatedByFilter}
              onValueChange={(v) => {
                setUpdatedByFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Last edited by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Last edited by: anyone</SelectItem>
                {user && <SelectItem value={user.id}>Last edited by: me</SelectItem>}
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name || person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {totalCount > ITEMS_PER_PAGE 
                ? `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, totalCount)} of ${totalCount} products`
                : `${totalCount} product${totalCount !== 1 ? 's' : ''}`
              }
            </Badge>
          </div>

          {/* Bulk action bar */}
          {selection.selectedCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">
                {selection.selectedCount} selected
              </span>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign work
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
                <ListChecks className="h-4 w-4 mr-2" />
                Bulk edit
              </Button>
              {canBulkDelete && (
                <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={selection.deselectAll}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium mb-1">
                {debouncedSearch ? 'No products found' : 'No products yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {debouncedSearch
                  ? 'Try adjusting your search terms'
                  : 'Add your first product to the catalog'}
              </p>
              {!debouncedSearch && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selection.isAllSelected}
                        onCheckedChange={() => selection.toggleSelectAll()}
                        aria-label="Select all products on this page"
                      />
                    </TableHead>
                    <TableHead>Model No / Description</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>HSN Code</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Selling Rate</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead className="text-center">Margin</TableHead>
                    <TableHead className="text-center">GST</TableHead>
                    <TableHead>Price Updated</TableHead>
                    <TableHead>Added by</TableHead>
                    <TableHead>Last edited by</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[50px] sticky right-0 bg-card z-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const pricing = computePricing(product as any);
                    const margin = pricing.grossMarginPct;
                    const eligibility = quoteEligibility(product as any);
                    const status = pricing.status;
                    return (
                      <TableRow key={product.id} data-state={selection.isSelected(product.id) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selection.isSelected(product.id)}
                            onCheckedChange={() => selection.toggleSelection(product.id)}
                            aria-label={`Select ${(product as any).model_number || product.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1">
                            <Link to={`/products/${product.id}`} className="group block min-w-0">
                              <p className="font-medium group-hover:underline flex items-center gap-1">
                                {(product as any).model_number || product.name}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                              </p>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </Link>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {canEditProducts && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Edit product"
                                  onClick={() => handleEdit(product)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canBulkDelete && status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Delete product"
                                  onClick={() => setDeleteProduct(product)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManageStock ? (
                            <button
                              type="button"
                              title="Adjust stock"
                              onClick={() => setStockProduct(product)}
                              className="text-left"
                            >
                              {(stockMap?.get(product.id)?.qty ?? 0) > 0 ? (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20">
                                  Ready Stock · {stockMap!.get(product.id)!.qty}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs underline decoration-dotted">Add stock</span>
                              )}
                            </button>
                          ) : (stockMap?.get(product.id)?.qty ?? 0) > 0 ? (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-200">
                              Ready Stock · {stockMap!.get(product.id)!.qty}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{(product as any).brand || '-'}</TableCell>
                        <TableCell>
                          {product.hsn_code ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {product.hsn_code}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{product.unit || 'Nos'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(pricing.salesPrice ?? product.default_rate)}
                          {(stockMap?.get(product.id)?.qty ?? 0) > 0 && (
                            <div className="text-[10px] font-normal text-green-700">
                              +{READY_STOCK_PREMIUM_PCT}%: {formatCurrency(applyReadyStockPremium(pricing.salesPrice ?? product.default_rate))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.purchase_price ? (
                            <span className="font-medium">{formatCurrency(product.purchase_price)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {margin !== null ? (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                margin >= 20 
                                  ? 'bg-green-500/10 text-green-600 border-green-200' 
                                  : margin >= 10 
                                    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
                                    : margin >= 0
                                      ? 'bg-orange-500/10 text-orange-600 border-orange-200'
                                      : 'bg-red-500/10 text-red-600 border-red-200'
                              }`}
                            >
                              {margin.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {product.tax_rate || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className={`text-xs flex items-center gap-1 ${getPriceAgeColor(product.price_updated_at)}`}>
                              <Clock className="h-3 w-3" />
                              {getPriceAge(product.price_updated_at)}
                            </span>
                            {canSeeUpdater && product.price_updater?.full_name && (
                              <span className="text-xs text-muted-foreground">
                                by {product.price_updater.full_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs">
                              {personName(product.created_by, product.creator) ?? 'Unknown'}
                            </span>
                            {timeAgo(product.created_at) && (
                              <span className="text-[10px] text-muted-foreground">{timeAgo(product.created_at)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs">
                              {personName(product.updated_by, product.editor) ?? 'Unknown'}
                            </span>
                            {timeAgo(product.updated_at) && (
                              <span className="text-[10px] text-muted-foreground">{timeAgo(product.updated_at)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge
                              variant="outline"
                              className={
                                status === 'active'
                                  ? 'bg-green-500/10 text-green-600 border-green-200'
                                  : status === 'discontinued'
                                    ? 'bg-amber-500/10 text-amber-600 border-amber-200'
                                    : 'bg-red-500/10 text-red-600 border-red-200'
                              }
                            >
                              {PRODUCT_STATUS_LABEL[status]}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{eligibility.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="sticky right-0 bg-card">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/products/${product.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open product
                                </Link>
                              </DropdownMenuItem>
                              {canEditProducts && (
                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canBulkDelete && status === 'active' && (
                                <DropdownMenuItem
                                  onClick={() => setDeleteProduct(product)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 py-2 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      <BulkImportDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

      <ImportProductsDialog open={activeImportOpen} onOpenChange={setActiveImportOpen} type="active" />

      <ImportProductsDialog open={legacyImportOpen} onOpenChange={setLegacyImportOpen} type="legacy" />

      <ListPriceUploadDialog open={listPriceOpen} onOpenChange={setListPriceOpen} />

      <ModelDuplicatesDialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen} />

      <ProductDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        product={editProduct}
        showPurchasePrice={true}
      />

      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssignProductWorkDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        productIds={selectedIds}
        onAssigned={selection.deselectAll}
      />

      <ProductBulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        productIds={selectedIds}
        onDone={selection.deselectAll}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} products</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {selectedIds.length} selected product
              {selectedIds.length === 1 ? '' : 's'} from the catalog. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {stockProduct && (
        <ProductStockDialog
          open={!!stockProduct}
          onOpenChange={(open) => !open && setStockProduct(null)}
          productId={stockProduct.id}
          productLabel={(stockProduct as any).model_number || stockProduct.name}
          unit={stockProduct.unit}
        />
      )}
    </>
  );
}