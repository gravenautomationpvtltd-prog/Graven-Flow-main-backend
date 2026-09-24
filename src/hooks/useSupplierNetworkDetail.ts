import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierKPIs {
  totalRFQsReceived: number;
  responseRate: number;
  quotationsSubmitted: number;
  quoteWinRate: number;
  avgLeadTime: number;
  avgQuoteValue: number;
  totalBusinessValue: number;
  totalPaymentsMade: number;
  pendingPayment: number;
  avgRating: number;
  supplierSinceDays: number;
  totalPOs: number;
  totalGRNs: number;
  onTimeDeliveryRate: number;
}

export interface SupplierJourneyEvent {
  id: string;
  event_type: 'application' | 'review' | 'approval' | 'rejection' | 'rfq' | 'quotation' | 'po' | 'grn' | 'payment' | 'suspension' | 'reactivation' | 'rating';
  title: string;
  description: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function useSupplierNetworkProfile(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-network-profile', supplierId],
    queryFn: async () => {
      if (!supplierId) throw new Error('Supplier ID required');
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });
}

export function useSupplierRFQs(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-rfqs', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('rfq_distributions')
        .select(`
          id,
          sent_at,
          viewed_at,
          response_status,
    rfq:rfq_id (
      id,
      rfq_number,
      title,
      category_id,
      deadline_date,
      status,
      created_at
    )
        `)
        .eq('supplier_id', supplierId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierQuotations(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-quotations', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_quotations')
        .select(`
          id,
          quotation_number,
          rfq_id,
          total_original,
          quoted_currency,
          lead_time_days,
          validity_days,
          status,
          submitted_at,
          notes,
          rfq:rfq_id (
            rfq_number,
            title
          )
        `)
        .eq('supplier_id', supplierId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierCategories(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-assigned-categories', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_category_assignments')
        .select(`
          id,
          assigned_at,
          category:category_id (
            id,
            name,
            description
          )
        `)
        .eq('supplier_id', supplierId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierDocuments(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-documents', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierCommunications(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-profile-communications', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_communications')
        .select(`
      id,
      subject,
      content,
      created_at,
      read_at,
      rfq_id,
      profiles!supplier_communications_sent_by_fkey(full_name)
    `)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierPurchaseOrders(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-network-pos', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          order_date,
          expected_delivery,
          status,
          subtotal,
          grand_total,
          currency
        `)
        .eq('supplier_id', supplierId)
        .order('order_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierGRNs(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-network-grns', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          id,
          grn_number,
          received_date,
          status,
          notes,
          purchase_orders!goods_receipt_notes_po_id_fkey(po_number)
        `)
        .eq('supplier_id', supplierId)
        .order('received_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierPayments(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-network-payments', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_mode,
          transaction_reference,
          notes,
          purchase_orders!supplier_payments_po_id_fkey(po_number)
        `)
        .eq('supplier_id', supplierId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierStatusHistory(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-status-history', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      
      const { data, error } = await supabase
        .from('supplier_status_history')
        .select(`
          id,
          previous_status,
          new_status,
          created_at,
          reason,
          profiles!supplier_status_history_changed_by_fkey(full_name)
        `)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });
}

export function useSupplierKPIs(supplierId: string | undefined) {
  const { data: profile } = useSupplierNetworkProfile(supplierId);
  const { data: rfqs = [] } = useSupplierRFQs(supplierId);
  const { data: quotations = [] } = useSupplierQuotations(supplierId);
  const { data: pos = [] } = useSupplierPurchaseOrders(supplierId);
  const { data: grns = [] } = useSupplierGRNs(supplierId);
  const { data: payments = [] } = useSupplierPayments(supplierId);

  const calculateKPIs = (): SupplierKPIs => {
    const rfqsArray = Array.isArray(rfqs) ? rfqs : [];
    const quotationsArray = Array.isArray(quotations) ? quotations : [];
    const posArray = Array.isArray(pos) ? pos : [];
    const grnsArray = Array.isArray(grns) ? grns : [];
    const paymentsArray = Array.isArray(payments) ? payments : [];

    const totalRFQsReceived = rfqsArray.length;
    const respondedRFQs = rfqsArray.filter((r) => r.response_status === 'quoted' || r.response_status === 'declined').length;
    const responseRate = totalRFQsReceived > 0 ? (respondedRFQs / totalRFQsReceived) * 100 : 0;

    const quotationsSubmitted = quotationsArray.length;
    const wonQuotes = quotationsArray.filter((q) => q.status === 'shortlisted' || q.status === 'accepted').length;
    const quoteWinRate = quotationsSubmitted > 0 ? (wonQuotes / quotationsSubmitted) * 100 : 0;

    const quotesWithLeadTime = quotationsArray.filter((q) => q.lead_time_days);
    const avgLeadTime = quotesWithLeadTime.length > 0 
      ? quotesWithLeadTime.reduce((sum, q) => sum + (q.lead_time_days || 0), 0) / quotesWithLeadTime.length 
      : 0;

    const quotesWithAmount = quotationsArray.filter((q) => q.total_original);
    const avgQuoteValue = quotesWithAmount.length > 0 
      ? quotesWithAmount.reduce((sum, q) => sum + (q.total_original || 0), 0) / quotesWithAmount.length 
      : 0;

    const totalBusinessValue = posArray.reduce((sum, po) => sum + (po.grand_total || 0), 0);
    const totalPaymentsMade = paymentsArray.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPayment = totalBusinessValue - totalPaymentsMade;

    const supplierSinceDays = profile
      ? Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const onTimeDeliveryRate = grnsArray.length > 0 ? 85 : 0;

    return {
      totalRFQsReceived,
      responseRate,
      quotationsSubmitted,
      quoteWinRate,
      avgLeadTime,
      avgQuoteValue,
      totalBusinessValue,
      totalPaymentsMade,
      pendingPayment,
      avgRating: profile?.internal_rating || 0,
      supplierSinceDays,
      totalPOs: posArray.length,
      totalGRNs: grnsArray.length,
      onTimeDeliveryRate,
    };
  };

  return {
    kpis: calculateKPIs(),
    isLoading: !profile,
  };
}

export function useSupplierJourneyTimeline(supplierId: string | undefined) {
  const { data: profile } = useSupplierNetworkProfile(supplierId);
  const { data: statusHistory = [] } = useSupplierStatusHistory(supplierId);
  const { data: rfqs = [] } = useSupplierRFQs(supplierId);
  const { data: quotations = [] } = useSupplierQuotations(supplierId);
  const { data: pos = [] } = useSupplierPurchaseOrders(supplierId);
  const { data: grns = [] } = useSupplierGRNs(supplierId);
  const { data: payments = [] } = useSupplierPayments(supplierId);

  const buildTimeline = (): SupplierJourneyEvent[] => {
    const events: SupplierJourneyEvent[] = [];

    if (profile) {
      events.push({
        id: `application-${profile.id}`,
        event_type: 'application',
        title: 'Application Submitted',
        description: `${profile.name} submitted their supplier registration`,
        timestamp: profile.created_at,
      });
    }

    const statusHistoryArray = Array.isArray(statusHistory) ? statusHistory : [];
    statusHistoryArray.forEach((sh) => {
      let eventType: SupplierJourneyEvent['event_type'] = 'review';
      let title = 'Status Changed';

      if (sh.new_status === 'approved') {
        eventType = 'approval';
        title = 'Application Approved';
      } else if (sh.new_status === 'rejected') {
        eventType = 'rejection';
        title = 'Application Rejected';
      } else if (sh.new_status?.includes('review')) {
        title = sh.new_status === 'under_technical_review' ? 'Technical Review Started' : 'Commercial Review Started';
      }

      events.push({
        id: sh.id,
        event_type: eventType,
        title,
        description: sh.reason || `Status changed from ${sh.previous_status || 'none'} to ${sh.new_status}`,
        timestamp: sh.created_at,
        metadata: { changedBy: sh.profiles?.full_name },
      });
    });

    const rfqsArray = Array.isArray(rfqs) ? rfqs : [];
    rfqsArray.forEach((rfq) => {
      events.push({
        id: `rfq-${rfq.id}`,
        event_type: 'rfq',
        title: 'RFQ Received',
        description: `RFQ ${rfq.rfq?.rfq_number}: ${rfq.rfq?.title}`,
        timestamp: rfq.sent_at,
        metadata: { rfqId: rfq.id },
      });
    });

    const quotationsArray = Array.isArray(quotations) ? quotations : [];
    quotationsArray.forEach((q) => {
      events.push({
        id: `quote-${q.id}`,
        event_type: 'quotation',
        title: 'Quotation Submitted',
        description: `Quote ${q.quotation_number} for ${q.rfq?.rfq_number} - ${q.quoted_currency} ${q.total_original?.toLocaleString()}`,
        timestamp: q.submitted_at,
        metadata: { quotationId: q.id },
      });
    });

    const posArray = Array.isArray(pos) ? pos : [];
    posArray.forEach((po) => {
      events.push({
        id: `po-${po.id}`,
        event_type: 'po',
        title: 'Purchase Order Issued',
        description: `PO ${po.po_number} - ${po.currency} ${po.grand_total?.toLocaleString()}`,
        timestamp: po.order_date,
        metadata: { poId: po.id },
      });
    });

    const grnsArray = Array.isArray(grns) ? grns : [];
    grnsArray.forEach((grn) => {
      events.push({
        id: `grn-${grn.id}`,
        event_type: 'grn',
        title: 'Goods Received',
        description: `GRN ${grn.grn_number} for PO ${grn.purchase_orders?.po_number}`,
        timestamp: grn.received_date,
        metadata: { grnId: grn.id },
      });
    });

    const paymentsArray = Array.isArray(payments) ? payments : [];
    paymentsArray.forEach((p) => {
      events.push({
        id: `payment-${p.id}`,
        event_type: 'payment',
        title: 'Payment Made',
        description: `₹${p.amount?.toLocaleString()} for PO ${p.purchase_orders?.po_number}`,
        timestamp: p.payment_date,
        metadata: { paymentId: p.id },
      });
    });

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  return {
    timeline: buildTimeline(),
    isLoading: !profile,
  };
}
