import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, History, Package, Pencil, Trash2, Warehouse } from 'lucide-react';
import { ProductStockDialog } from '@/components/inventory/ProductStockDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useProductDetail, useProductPriceVersions } from '@/hooks/useProductDetail';
import { useDeleteProduct } from '@/hooks/useProducts';
import { ProductDialog } from '@/components/settings/ProductDialog';
import { useAuth } from '@/hooks/useAuth';
import { PRODUCT_STATUS_LABEL, computePricing, formatINR, quoteEligibility, checkMargin } from '@/lib/pricing';
import { formatDimensions } from '@/lib/product-csv';
import { useProductStock } from '@/hooks/useReadyStock';
import { useStockMovements } from '@/hooks/useInventory';
import { applyReadyStockPremium, READY_STOCK_PREMIUM_PCT } from '@/lib/ready-stock';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProductDetail(id);
  const { data: versions = [] } = useProductPriceVersions(id);
  const { data: stock } = useProductStock(id);
  const { data: movements = [] } = useStockMovements(id);
  const { isAdmin, isManager, isProcurement, isBIE, isWarehouse, isAccounts } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const canManageStock = isAdmin || isManager || isProcurement || isWarehouse || isAccounts;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteProduct = useDeleteProduct();
  const canEdit = isAdmin || isManager || isProcurement || isBIE;
  const canDelete = isAdmin || isManager || isProcurement || isBIE;

  const handleDelete = async () => {
    if (!product) return;
    await deleteProduct.mutateAsync(product.id);
    setDeleteOpen(false);
    navigate('/products');
  };


  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!product) return <p className="text-muted-foreground">Product not found.</p>;

  const pricing = computePricing(product);
  const eligibility = quoteEligibility(product);
  const margin = checkMargin(pricing.salesPrice, pricing.purchasePrice, product.min_margin_pct);

  return (
    <>
      <Helmet>
        <title>{`${product.model_number || product.name} | Product | Graven OneDesk`}</title>
        <meta name="description" content={`Pricing, margin and price history for ${product.model_number || product.name}.`} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Package className="h-7 w-7 text-primary mt-1" />
            <div>
              <h1 className="text-2xl font-bold">{product.model_number || product.name}</h1>
              <p className="text-muted-foreground">{product.description}</p>
              <div className="flex items-center gap-2 mt-2">
                {product.brand && <Badge variant="outline">{product.brand}</Badge>}
                <Badge
                  variant="outline"
                  className={
                    pricing.status === 'active'
                      ? 'bg-green-500/10 text-green-600 border-green-200'
                      : pricing.status === 'discontinued'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-200'
                        : 'bg-red-500/10 text-red-600 border-red-200'
                  }
                >
                  {PRODUCT_STATUS_LABEL[pricing.status]}
                </Badge>
                <Badge variant="secondary">{eligibility.label}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Edit product
              </Button>
            )}
            {canDelete && pricing.status === 'active' && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />Delete
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/products"><ArrowLeft className="h-4 w-4 mr-2" />Back to catalog</Link>
            </Button>
          </div>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{product.model_number || product.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteProduct.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteProduct.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {canEdit && (
          <ProductDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            product={product}
            showPurchasePrice
          />
        )}

        {pricing.status !== 'active' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{PRODUCT_STATUS_LABEL[pricing.status].toUpperCase()} PRODUCT</AlertTitle>
            <AlertDescription>
              {pricing.status === 'obsolete'
                ? 'This product is marked as obsolete.'
                : 'This product is no longer actively supplied by the manufacturer.'}
              {product.replacement_model_no && (
                <div className="mt-1 font-medium">Recommended replacement: {product.replacement_model_no}</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {margin.belowMinimum && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Margin below minimum</AlertTitle>
            <AlertDescription>
              Gross margin (on cost) {margin.marginPct}% is below the {margin.minPct}% threshold — approval required.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Current pricing</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="List Price" value={formatINR(pricing.listPrice)} />
              <Row label="Sales Discount" value={pricing.salesDiscountPct === null ? '—' : `${pricing.salesDiscountPct}%`} />
              <Row label="Sales Price" value={formatINR(pricing.salesPrice)} strong />
              <Row label="Purchase Discount" value={pricing.purchaseDiscountPct === null ? '—' : `${pricing.purchaseDiscountPct}%`} />
              <Row label="Purchase Price" value={formatINR(pricing.purchasePrice)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Profitability</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Gross Profit" value={formatINR(pricing.grossProfit)} strong />
              <Row label="Gross Margin % (on cost)" value={pricing.grossMarginPct === null ? '—' : `${pricing.grossMarginPct}%`} strong />
              <Row label="Minimum Margin %" value={`${margin.minPct}%`} />
              <Row label="Quotation eligibility" value={eligibility.label} />
              <p className="text-xs text-muted-foreground pt-1">{eligibility.description}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Warehouse stock</CardTitle>
            {canManageStock && (
              <Button variant="outline" size="sm" onClick={() => setStockOpen(true)}>
                <Warehouse className="h-4 w-4 mr-2" />Adjust stock
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Available quantity" value={stock ? String(stock.qty) : '0'} strong />
            {(stock?.byOffice.length ?? 0) > 0 ? (
              <>
                {stock!.byOffice.map((o) => (
                  <Row key={o.officeId} label={o.officeName} value={String(o.qty)} />
                ))}
                <Row
                  label={`Ready-stock price (+${READY_STOCK_PREMIUM_PCT}%)`}
                  value={formatINR(applyReadyStockPremium(pricing.salesPrice))}
                  strong
                />
                <p className="text-xs text-muted-foreground pt-1">
                  Available for immediate dispatch — quotations default to the ready-stock price and can be
                  reduced manually.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">Not in stock — quoted at the standard sales price.</p>
            )}

            {movements.length > 0 && (
              <div className="pt-3 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recent stock movements</p>
                {movements.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString('en-IN')} ·{' '}
                      {m.movement_type === 'in' ? 'Received' : m.movement_type === 'out' ? 'Issued' : 'Corrected'}
                      {m.reference_type ? ` (${m.reference_type})` : ''}
                      {m.creator?.full_name ? ` · ${m.creator.full_name}` : ''}
                    </span>
                    <span className={m.movement_type === 'out' ? 'text-red-600' : 'text-green-700'}>
                      {m.movement_type === 'out' ? '-' : '+'}{Math.abs(m.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {canManageStock && (
          <ProductStockDialog
            open={stockOpen}
            onOpenChange={setStockOpen}
            productId={product.id}
            productLabel={product.model_number || product.name}
            unit={product.unit}
          />
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Logistics (packing &amp; shipping only)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Weight"
              value={(product as any).weight_kg == null ? '—' : `${(product as any).weight_kg} KG`}
            />
            <Row
              label="Dimensions (L × W × H)"
              value={formatDimensions((product as any).length_cm, (product as any).width_cm, (product as any).height_cm)}
            />
            <p className="text-xs text-muted-foreground pt-1">
              Used for packing lists and shipping only — never priced and never printed on quotations or invoices.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Price history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price versions recorded yet.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">List Price</TableHead>
                      <TableHead className="text-right">Sales Disc.</TableHead>
                      <TableHead className="text-right">Purchase Disc.</TableHead>
                      <TableHead className="text-right">Sales Price</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-sm">
                          {new Date(v.effective_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatINR(v.new_list_price)}</TableCell>
                        <TableCell className="text-right text-sm">{v.new_sales_discount_pct ?? '—'}%</TableCell>
                        <TableCell className="text-right text-sm">{v.new_purchase_discount_pct ?? '—'}%</TableCell>
                        <TableCell className="text-right text-sm">{formatINR(v.new_sales_price)}</TableCell>
                        <TableCell className="text-right text-sm">{formatINR(v.new_purchase_price)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.source_label || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
