import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PriceResolutionDetail {
  id: string;
  requestedAt: string | null;
  resolvedAt: string | null;
  status: string;
  notes: string | null;
  resolutionTimeHours: number | null;
  productName: string | null;
  productSku: string | null;
  leadTitle: string | null;
  leadId: string | null;
  resolvedPrice: number | null;
  targetRate: number | null;
  supplierName: string | null;
  quantity: number | null;
}

export interface ProductUpdateDetail {
  id: string;
  name: string;
  sku: string | null;
  updatedAt: string | null;
  defaultRate: number | null;
  purchasePrice: number | null;
}

export interface PurchaseOrderItemDetail {
  id: string;
  productName: string | null;
  productSku: string | null;
  quantity: number;
  rate: number;
  amount: number;
  taxPercent: number | null;
  taxAmount: number | null;
}

export interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  grandTotal: number;
  status: string;
  createdAt: string;
  supplierName: string | null;
  supplierId: string | null;
  itemCount: number;
  orderDate: string | null;
  expectedDelivery: string | null;
  subtotal: number;
  totalTax: number;
  notes: string | null;
  supplierPhone: string | null;
  supplierContact: string | null;
  items: PurchaseOrderItemDetail[];
}

export interface GrnItemDetail {
  id: string;
  productName: string | null;
  productSku: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
}

export interface GrnDetail {
  id: string;
  grnNumber: string;
  receivedDate: string;
  status: string;
  createdAt: string;
  poNumber: string | null;
  poId: string | null;
  itemCount: number;
  notes: string | null;
  items: GrnItemDetail[];
}

export interface ProcurementMemberDetailData {
  priceResolutions: PriceResolutionDetail[];
  products: ProductUpdateDetail[];
  purchaseOrders: PurchaseOrderDetail[];
  grns: GrnDetail[];
}

export function useProcurementMemberDetail(
  userId: string | null, 
  startDate: string, 
  endDate: string
) {
  return useQuery({
    queryKey: ['procurement-member-detail', userId, startDate, endDate],
    queryFn: async (): Promise<ProcurementMemberDetailData | null> => {
      if (!userId) return null;

      // Fetch price resolutions with enhanced data
      const { data: priceRequests, error: prError } = await supabase
        .from('price_requests')
        .select(`
          id,
          requested_at,
          resolved_at,
          status,
          notes,
          resolved_price,
          target_rate,
          product:products(id, name, hsn_code),
          supplier:suppliers(id, company_name),
          enquiry_item:enquiry_items(
            quantity,
            lead:leads(id, title)
          )
        `)
        .eq('resolved_by', userId)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', startDate)
        .lte('resolved_at', endDate)
        .order('resolved_at', { ascending: false });

      if (prError) throw prError;

      const priceResolutions: PriceResolutionDetail[] = (priceRequests || []).map((pr: any) => {
        let resolutionTimeHours = null;
        if (pr.requested_at && pr.resolved_at) {
          const requestedAt = new Date(pr.requested_at).getTime();
          const resolvedAt = new Date(pr.resolved_at).getTime();
          resolutionTimeHours = (resolvedAt - requestedAt) / (1000 * 60 * 60);
        }
        return {
          id: pr.id,
          requestedAt: pr.requested_at,
          resolvedAt: pr.resolved_at,
          status: pr.status,
          notes: pr.notes,
          resolutionTimeHours,
          productName: pr.product?.name || null,
          productSku: pr.product?.hsn_code || null,
          leadTitle: pr.enquiry_item?.lead?.title || null,
          leadId: pr.enquiry_item?.lead?.id || null,
          resolvedPrice: pr.resolved_price ? Number(pr.resolved_price) : null,
          targetRate: pr.target_rate ? Number(pr.target_rate) : null,
          supplierName: pr.supplier?.company_name || null,
          quantity: pr.enquiry_item?.quantity || null,
        };
      });

      // Fetch products updated
      const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select('id, name, hsn_code, price_updated_at, default_rate, purchase_price')
        .eq('price_updated_by', userId)
        .not('price_updated_at', 'is', null)
        .gte('price_updated_at', startDate)
        .lte('price_updated_at', endDate)
        .order('price_updated_at', { ascending: false });

      if (prodError) throw prodError;

      const products: ProductUpdateDetail[] = (productsData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.hsn_code,
        updatedAt: p.price_updated_at,
        defaultRate: p.default_rate,
        purchasePrice: p.purchase_price,
      }));

      // Fetch purchase orders with full item details
      const { data: posData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          grand_total,
          status,
          created_at,
          order_date,
          expected_delivery,
          subtotal,
          total_tax,
          notes,
          supplier:suppliers(id, company_name, contact_person, phone),
          purchase_order_items(
            id,
            quantity,
            rate,
            amount,
            tax_percent,
            tax_amount,
            product:products(id, name, hsn_code)
          )
        `)
        .eq('created_by', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (poError) throw poError;

      const purchaseOrders: PurchaseOrderDetail[] = (posData || []).map((po: any) => ({
        id: po.id,
        poNumber: po.po_number,
        grandTotal: Number(po.grand_total) || 0,
        status: po.status,
        createdAt: po.created_at,
        supplierName: po.supplier?.company_name || null,
        supplierId: po.supplier?.id || null,
        itemCount: po.purchase_order_items?.length || 0,
        orderDate: po.order_date,
        expectedDelivery: po.expected_delivery,
        subtotal: Number(po.subtotal) || 0,
        totalTax: Number(po.total_tax) || 0,
        notes: po.notes,
        supplierPhone: po.supplier?.phone || null,
        supplierContact: po.supplier?.contact_person || null,
        items: (po.purchase_order_items || []).map((item: any) => ({
          id: item.id,
          productName: item.product?.name || null,
          productSku: item.product?.hsn_code || null,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0,
          taxPercent: item.tax_percent ? Number(item.tax_percent) : null,
          taxAmount: item.tax_amount ? Number(item.tax_amount) : null,
        })),
      }));

      // Fetch GRNs with item details
      const { data: grnsData, error: grnError } = await supabase
        .from('goods_receipt_notes')
        .select(`
          id,
          grn_number,
          received_date,
          status,
          created_at,
          notes,
          purchase_order:purchase_orders(id, po_number),
          grn_items(
            id,
            ordered_quantity,
            received_quantity,
            accepted_quantity,
            rejected_quantity,
            product:products(id, name, hsn_code)
          )
        `)
        .eq('received_by', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (grnError) throw grnError;

      const grns: GrnDetail[] = (grnsData || []).map((grn: any) => ({
        id: grn.id,
        grnNumber: grn.grn_number,
        receivedDate: grn.received_date,
        status: grn.status,
        createdAt: grn.created_at,
        poNumber: grn.purchase_order?.po_number || null,
        poId: grn.purchase_order?.id || null,
        itemCount: grn.grn_items?.length || 0,
        notes: grn.notes,
        items: (grn.grn_items || []).map((item: any) => ({
          id: item.id,
          productName: item.product?.name || null,
          productSku: item.product?.hsn_code || null,
          orderedQuantity: Number(item.ordered_quantity) || 0,
          receivedQuantity: Number(item.received_quantity) || 0,
          acceptedQuantity: Number(item.accepted_quantity) || 0,
          rejectedQuantity: Number(item.rejected_quantity) || 0,
        })),
      }));

      return {
        priceResolutions,
        products,
        purchaseOrders,
        grns,
      };
    },
    enabled: !!userId,
  });
}
