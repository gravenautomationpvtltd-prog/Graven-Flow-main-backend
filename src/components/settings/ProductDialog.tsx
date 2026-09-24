import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useActiveSuppliers } from '@/hooks/useSuppliers';
import type { Product } from '@/hooks/useQuotations';
import { applyDiscount, grossMarginPct } from '@/lib/pricing';

const PRODUCT_CATEGORIES = [
  'PLC',
  'VFD',
  'HMI',
  'Sensors',
  'Cables',
  'Accessories',
  'Motors',
  'Drives',
  'Other',
] as const;

const productSchema = z.object({
  model_number: z.string().min(1, 'Model number is required').max(100),
  description: z.string().max(500).optional(),
  hsn_code: z.string().max(20).optional(),
  unit: z.string().default('Nos'),
  category: z.string().nullable().optional(),
  default_rate: z.coerce.number().min(0).default(0),
  purchase_price: z.coerce.number().min(0).optional().nullable(),
  tax_rate: z.coerce.number().min(0).max(100).default(18),
  lead_time_days: z.coerce.number().int().min(0).optional().nullable(),
  preferred_supplier_id: z.string().nullable().optional(),
  price_valid_until: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  product_status: z.enum(['active', 'discontinued', 'obsolete']).default('active'),
  // Not persisted — decides whether prices are derived from the list price or typed net.
  pricing_mode: z.enum(['list', 'net']).default('list'),
  replacement_model_no: z.string().max(100).nullable().optional(),
  list_price: z.coerce.number().min(0).optional().nullable(),
  sales_discount_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  purchase_discount_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  // Logistics only — never priced, never shown on commercial documents.
  weight_kg: z.coerce.number().min(0).optional().nullable(),
  length_cm: z.coerce.number().min(0).optional().nullable(),
  width_cm: z.coerce.number().min(0).optional().nullable(),
  height_cm: z.coerce.number().min(0).optional().nullable(),
}).superRefine((d, ctx) => {
  if (d.pricing_mode === 'net') {
    if (!d.default_rate || d.default_rate <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['default_rate'], message: 'Enter the net sales price' });
    }
  } else if ((d.sales_discount_pct != null || d.purchase_discount_pct != null) && d.list_price == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['list_price'], message: 'List price is required when a discount is set' });
  }
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  defaultName?: string;
  onProductCreated?: (product: Product) => void;
  showPurchasePrice?: boolean;
}

export function ProductDialog({ 
  open, 
  onOpenChange, 
  product, 
  defaultName, 
  onProductCreated,
  showPurchasePrice = false 
}: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: suppliers = [] } = useActiveSuppliers();
  const isEditing = !!product;
  const pricingModeTouched = React.useRef(false);
  const modeFor = (p: any): 'list' | 'net' => {
    if (!p) return 'list';
    const status = p.product_status || 'active';
    if (p.list_price != null) return 'list';
    if (status !== 'active') return 'net';
    return p.default_rate || p.purchase_price != null ? 'net' : 'list';
  };

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      model_number: (product as any)?.model_number || defaultName || '',
      description: product?.description || '',
      hsn_code: product?.hsn_code || '',
      unit: product?.unit || 'Nos',
      category: product?.category || null,
      default_rate: product?.default_rate || 0,
      purchase_price: product?.purchase_price || null,
      tax_rate: product?.tax_rate || 18,
      lead_time_days: product?.lead_time_days || null,
      preferred_supplier_id: product?.preferred_supplier_id || null,
      price_valid_until: (product as any)?.price_valid_until || null,
      is_active: product?.is_active ?? true,
      product_status: (product as any)?.product_status || 'active',
      replacement_model_no: (product as any)?.replacement_model_no || null,
      list_price: (product as any)?.list_price ?? null,
      sales_discount_pct: (product as any)?.sales_discount_pct ?? null,
      purchase_discount_pct: (product as any)?.purchase_discount_pct ?? null,
      weight_kg: (product as any)?.weight_kg ?? null,
      length_cm: (product as any)?.length_cm ?? null,
      width_cm: (product as any)?.width_cm ?? null,
      height_cm: (product as any)?.height_cm ?? null,
      pricing_mode: modeFor(product),
    },
  });

  // Reset form when dialog opens - for both edit and create modes
  React.useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          model_number: (product as any).model_number || product.name || '',
          description: product.description || '',
          hsn_code: product.hsn_code || '',
          unit: product.unit || 'Nos',
          category: product.category || null,
          default_rate: product.default_rate || 0,
          purchase_price: product.purchase_price || null,
          tax_rate: product.tax_rate || 18,
          lead_time_days: product.lead_time_days || null,
          preferred_supplier_id: product.preferred_supplier_id || null,
          price_valid_until: (product as any).price_valid_until || null,
          is_active: product.is_active ?? true,
          product_status: (product as any).product_status || 'active',
          replacement_model_no: (product as any).replacement_model_no || null,
          list_price: (product as any).list_price ?? null,
          sales_discount_pct: (product as any).sales_discount_pct ?? null,
          purchase_discount_pct: (product as any).purchase_discount_pct ?? null,
          weight_kg: (product as any).weight_kg ?? null,
          length_cm: (product as any).length_cm ?? null,
          width_cm: (product as any).width_cm ?? null,
          height_cm: (product as any).height_cm ?? null,
          pricing_mode: modeFor(product),
        });
      } else {
        form.reset({
          model_number: defaultName || '',
          description: '',
          hsn_code: '',
          unit: 'Nos',
          category: null,
          default_rate: 0,
          purchase_price: null,
          tax_rate: 18,
          lead_time_days: null,
          preferred_supplier_id: null,
          price_valid_until: null,
          is_active: true,
          product_status: 'active',
          replacement_model_no: null,
          list_price: null,
          sales_discount_pct: null,
          purchase_discount_pct: null,
          weight_kg: null,
          length_cm: null,
          width_cm: null,
          height_cm: null,
          pricing_mode: 'list',
        });
      }
      pricingModeTouched.current = false;
    }
  }, [open, product, defaultName, form]);

  // Discontinued and obsolete items default to net-price entry until the user picks otherwise.
  const watchStatus = form.watch('product_status');
  React.useEffect(() => {
    if (!open || pricingModeTouched.current) return;
    form.setValue('pricing_mode', watchStatus === 'active' ? 'list' : 'net');
  }, [watchStatus, open, form]);

  const onSubmit = async (data: ProductFormData) => {
    // Either derive both prices from one list price and two discounts, or take the net prices as typed.
    const netMode = data.pricing_mode === 'net';
    const derivedSales = applyDiscount(data.list_price, data.sales_discount_pct);
    const derivedPurchase = applyDiscount(data.list_price, data.purchase_discount_pct);
    const salesPrice = netMode ? (data.default_rate || null) : (derivedSales ?? (data.default_rate || null));
    const purchasePrice = netMode ? (data.purchase_price ?? null) : (derivedPurchase ?? data.purchase_price ?? null);


    // Keep the stored code exactly as it already is when the user didn't touch it —
    // re-casing an untouched model number can collide with another product.
    const typedModel = data.model_number.trim();
    const existingModel = ((product as any)?.model_number || '').trim();
    const modelSaved = existingModel && existingModel === typedModel
      ? existingModel
      : typedModel.toUpperCase();
    const shared = {
      // The catalog has no separate product name — it mirrors the model number.
      name: modelSaved,
      model_number: modelSaved,
      description: data.description || null,
      hsn_code: data.hsn_code || null,
      unit: data.unit,
      default_rate: salesPrice ?? data.default_rate,
      purchase_price: purchasePrice,
      category: data.category ?? null,
      tax_rate: data.tax_rate,
      is_active: data.is_active,
      lead_time_days: data.lead_time_days ?? null,
      price_valid_until: data.price_valid_until || null,
      preferred_supplier_id: data.preferred_supplier_id ?? null,
      product_status: data.product_status,
      replacement_model_no: data.replacement_model_no || null,
      list_price: data.list_price ?? null,
      sales_discount_pct: data.sales_discount_pct ?? null,
      purchase_discount_pct: data.purchase_discount_pct ?? null,
      sales_price: salesPrice,
      weight_kg: data.weight_kg ?? null,
      length_cm: data.length_cm ?? null,
      width_cm: data.width_cm ?? null,
      height_cm: data.height_cm ?? null,
    } as any;

    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, ...shared });
      } else {
        const newProduct = await createProduct.mutateAsync(shared);
        if (newProduct) {
          onProductCreated?.(newProduct);
        }
      }
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      // A model-number clash belongs on the field itself, not only in a toast.
      const message = String(error?.message || '');
      if (/already used by another product|already exists in the catalogue/i.test(message)) {
        form.setError('model_number', { type: 'manual', message });
      }
    }
  };

  // Effective prices, whichever entry method is in use
  const pricingMode = form.watch('pricing_mode');
  const watchDefaultRate = form.watch('default_rate');
  const watchPurchasePrice = form.watch('purchase_price');
  const watchListPrice = form.watch('list_price');
  const watchSalesDisc = form.watch('sales_discount_pct');
  const watchPurchaseDisc = form.watch('purchase_discount_pct');

  const effectiveSales = pricingMode === 'net'
    ? (watchDefaultRate ?? null)
    : applyDiscount(watchListPrice, watchSalesDisc);
  const effectivePurchase = pricingMode === 'net'
    ? (watchPurchasePrice ?? null)
    : applyDiscount(watchListPrice, watchPurchaseDisc);

  const margin = effectivePurchase && effectivePurchase > 0 && effectiveSales
    ? ((effectiveSales - effectivePurchase) / effectivePurchase) * 100
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Edit product details' : 'Add a new product to the catalog'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-4">
              <div className="space-y-4 pb-4">
            <FormField
              control={form.control}
              name="model_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 6FC52100DF212AA0" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {isEditing && !(product as any)?.model_number
                      ? 'Suggested from this product — please check it before saving. Printed in bold as the first line on quotations.'
                      : 'Printed in bold as the first line on quotations, with the description below it.'}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Product specifications and details..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="product_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                        <SelectItem value="obsolete">Obsolete</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="replacement_model_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replacement Model No</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing — one block. Either derive from the list price, or type net prices. */}
            <div className="space-y-3 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="pricing_mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing method</FormLabel>
                    <Select
                      onValueChange={(v) => { pricingModeTouched.current = true; field.onChange(v); }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="list">From list price &amp; discounts</SelectItem>
                        <SelectItem value="net">Net prices (enter directly)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {pricingMode === 'list' && (
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="list_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>List Price (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" step="0.01"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sales_discount_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Disc. %</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" max="100" step="0.01"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchase_discount_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Disc. %</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" max="100" step="0.01"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="default_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Price (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min="0" step="0.01"
                          disabled={pricingMode === 'list'}
                          {...field}
                          value={pricingMode === 'list' ? (effectiveSales ?? '') : (field.value ?? '')}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min="0" step="0.01"
                          placeholder="Cost price"
                          disabled={pricingMode === 'list'}
                          {...field}
                          value={pricingMode === 'list' ? (effectivePurchase ?? '') : (field.value ?? '')}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {pricingMode === 'list' ? (
                <p className="text-xs text-muted-foreground">
                  Sales and purchase prices are calculated from the list price and the two discounts.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Net prices are used as entered — best for discontinued and obsolete items with no live list price.
                </p>
              )}

              <DerivedPricingHint sales={effectiveSales} purchase={effectivePurchase} />
            </div>

            {/* Logistics — kilograms and centimetres only, never shown on quotations or invoices */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Logistics (for packing &amp; shipping only)</p>
              <div className="grid grid-cols-4 gap-4">
                {([
                  ['weight_kg', 'Weight (KG)'],
                  ['length_cm', 'Length (CM)'],
                  ['width_cm', 'Width (CM)'],
                  ['height_cm', 'Height (CM)'],
                ] as const).map(([fieldName, label]) => (
                  <FormField
                    key={fieldName}
                    control={form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" step="0.01"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hsn_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 85371000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Nos">Nos</SelectItem>
                        <SelectItem value="Pcs">Pcs</SelectItem>
                        <SelectItem value="Set">Set</SelectItem>
                        <SelectItem value="Kg">Kg</SelectItem>
                        <SelectItem value="Mtr">Mtr</SelectItem>
                        <SelectItem value="Ltr">Ltr</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lead_time_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="1" 
                        placeholder="e.g., 14"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price valid until</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showPurchasePrice && (
              <FormField
                control={form.control}
                name="preferred_supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Supplier</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preferred supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No preferred supplier</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Lead time will auto-update when this supplier's quotation is accepted
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Rate (%)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseFloat(v))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {margin !== null && (
                <div className="flex flex-col justify-end">
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">Margin:</span>
                    <span className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Show this product in the catalog
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t bg-background flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                {isEditing ? 'Update' : 'Add'} Product
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
/** Shows the effective sales/purchase price, profit and margin while editing. */
function DerivedPricingHint({ sales, purchase }: { sales: number | null; purchase: number | null }) {
  if (sales === null && purchase === null) return null;
  const margin = grossMarginPct(sales, purchase);
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
      <div className="flex justify-between"><span>Sales Price</span><span className="font-medium">₹{(sales ?? 0).toLocaleString('en-IN')}</span></div>
      <div className="flex justify-between"><span>Purchase Price</span><span className="font-medium">₹{(purchase ?? 0).toLocaleString('en-IN')}</span></div>
      <div className="flex justify-between"><span>Gross Profit</span><span className="font-medium">₹{((sales ?? 0) - (purchase ?? 0)).toLocaleString('en-IN')}</span></div>
      <div className="flex justify-between"><span>Gross Margin (on cost)</span><span className="font-medium">{margin === null ? '—' : `${margin}%`}</span></div>
    </div>
  );
}
