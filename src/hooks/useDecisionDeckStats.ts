import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerIntelligence, useHighRiskCustomers } from './useCustomerIntelligence';
import { useSKUIntelligence, useDeadStockAlerts, useTrendingSKUs } from './useSKUIntelligence';
import { startOfMonth, endOfMonth, startOfYear, format, subMonths } from 'date-fns';

// Aggregated Decision Deck Statistics
export interface DecisionDeckStats {
  // Customer Intelligence Summary
  totalCustomers: number;
  buyLikelyCustomers: number;
  negotiationZoneCustomers: number;
  dropRiskCustomers: number;
  avgBuyingIntentScore: number;
  totalPriceLossValue: number;
  priceDrivenCustomers: number;
  
  // SKU Intelligence Summary
  totalActiveSKUs: number;
  trendingSKUs: number;
  maintainSKUs: number;
  liquidateSKUs: number;
  avgSKUMomentum: number;
  highDeadStockRiskSKUs: number;
  
  // Financial Snapshot
  currentCashBalance: number;
  mtdCashInflow: number;
  mtdCashOutflow: number;
  receivablesTotal: number;
  receivables0to15: number;
  receivables16to30: number;
  receivables31to60: number;
  receivables60Plus: number;
  payablesTotal: number;
  mtdRevenue: number;
  mtdExpenses: number;
  ytdRevenue: number;
  ytdExpenses: number;
  
  // Pending Approvals
  pendingPOApprovals: number;
  pendingPayrollApprovals: number;
  pendingVendorApprovals: number;
  pendingLeaveApprovals: number;
  totalPendingApprovals: number;
  
  // Performance Summary
  topPerformingSalesUser: { name: string; revenue: number; conversion: number } | null;
  topPerformingOffice: { name: string; revenue: number } | null;
  
  // Strategic Alerts Count
  criticalAlerts: number;
  warningAlerts: number;
}

export function useDecisionDeckStats() {
  const { data: customerIntelligence } = useCustomerIntelligence();
  const { data: skuIntelligence } = useSKUIntelligence();
  const { data: highRiskCustomers } = useHighRiskCustomers();
  const { data: deadStockAlerts } = useDeadStockAlerts();
  const { data: trendingSKUs } = useTrendingSKUs();

  return useQuery({
    queryKey: ['decision-deck-stats', customerIntelligence?.length, skuIntelligence?.length],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const yearStart = startOfYear(now).toISOString();

      // Fetch financial data
      const [
        { data: payments },
        { data: invoices },
        { data: supplierPayments },
        { data: pendingPOs },
        { data: payrollRuns },
        { data: pendingVendors },
        { data: leaveRequests },
        { data: salesOrders },
        { data: profiles },
        { data: offices },
      ] = await Promise.all([
        supabase.from('customer_payments').select('amount, payment_date') as any,
        supabase.from('invoices').select('grand_total, amount_paid, due_date, status, created_at'),
        supabase.from('supplier_payments').select('amount, payment_date'),
        supabase.from('purchase_orders').select('id, grand_total, status').eq('status', 'pending_approval') as any,
        supabase.from('payroll_runs').select('id, status').eq('status', 'pending_approval') as any,
        supabase.from('suppliers').select('id, status').eq('status', 'pending') as any,
        supabase.from('leave_requests').select('id, status').eq('status', 'pending') as any,
        supabase.from('sales_orders').select('id, order_value, created_by, created_at').gte('created_at', yearStart) as any,
        supabase.from('profiles').select('id, full_name, office_id') as any,
        supabase.from('offices').select('id, name') as any,
      ]);

      // Customer Intelligence Aggregation
      const customerStats = {
        totalCustomers: customerIntelligence?.length || 0,
        buyLikelyCustomers: customerIntelligence?.filter(c => c.intentClassification === 'buy_likely').length || 0,
        negotiationZoneCustomers: customerIntelligence?.filter(c => c.intentClassification === 'negotiation_zone').length || 0,
        dropRiskCustomers: customerIntelligence?.filter(c => c.intentClassification === 'drop_risk').length || 0,
        avgBuyingIntentScore: customerIntelligence?.length 
          ? Math.round(customerIntelligence.reduce((sum, c) => sum + c.buyingIntentScore, 0) / customerIntelligence.length)
          : 0,
        totalPriceLossValue: customerIntelligence?.reduce((sum, c) => sum + c.priceLossValue, 0) || 0,
        priceDrivenCustomers: customerIntelligence?.filter(c => c.priceSensitivityClassification === 'price_driven').length || 0,
      };

      // SKU Intelligence Aggregation
      const skuStats = {
        totalActiveSKUs: skuIntelligence?.length || 0,
        trendingSKUs: trendingSKUs?.length || 0,
        maintainSKUs: skuIntelligence?.filter(s => s.momentumClassification === 'maintain').length || 0,
        liquidateSKUs: skuIntelligence?.filter(s => s.momentumClassification === 'liquidate_avoid').length || 0,
        avgSKUMomentum: skuIntelligence?.length
          ? Math.round(skuIntelligence.reduce((sum, s) => sum + s.skuMomentumIndex, 0) / skuIntelligence.length)
          : 0,
        highDeadStockRiskSKUs: deadStockAlerts?.length || 0,
      };

      // Financial Calculations
      const mtdPayments = (payments || []).filter(p => 
        new Date(p.payment_date) >= new Date(monthStart) && 
        new Date(p.payment_date) <= new Date(monthEnd)
      );
      const mtdCashInflow = mtdPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const mtdSupplierPayments = (supplierPayments || []).filter(p =>
        new Date(p.payment_date) >= new Date(monthStart) &&
        new Date(p.payment_date) <= new Date(monthEnd)
      );
      const mtdCashOutflow = mtdSupplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Receivables Aging
      const unpaidInvoices = (invoices || []).filter(i => 
        i.status !== 'paid' && (i.grand_total || 0) > (i.amount_paid || 0)
      );
      
      const receivablesTotal = unpaidInvoices.reduce((sum, i) => 
        sum + ((i.grand_total || 0) - (i.amount_paid || 0)), 0
      );

      const getAgingBucket = (dueDate: string) => {
        const daysPast = Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysPast <= 15) return '0-15';
        if (daysPast <= 30) return '16-30';
        if (daysPast <= 60) return '31-60';
        return '60+';
      };

      let receivables0to15 = 0, receivables16to30 = 0, receivables31to60 = 0, receivables60Plus = 0;
      unpaidInvoices.forEach(inv => {
        const outstanding = (inv.grand_total || 0) - (inv.amount_paid || 0);
        const bucket = inv.due_date ? getAgingBucket(inv.due_date) : '60+';
        switch (bucket) {
          case '0-15': receivables0to15 += outstanding; break;
          case '16-30': receivables16to30 += outstanding; break;
          case '31-60': receivables31to60 += outstanding; break;
          default: receivables60Plus += outstanding;
        }
      });

      // MTD/YTD Revenue
      const mtdOrders = (salesOrders || []).filter((o: any) =>
        new Date(o.created_at) >= new Date(monthStart) &&
        new Date(o.created_at) <= new Date(monthEnd)
      );
      const mtdRevenue = mtdOrders.reduce((sum: number, o: any) => sum + (o.order_value || 0), 0);
      const ytdRevenue = (salesOrders || []).reduce((sum: number, o: any) => sum + (o.order_value || 0), 0);

      // Pending Approvals
      const pendingPOApprovals = pendingPOs?.length || 0;
      const pendingPayrollApprovals = payrollRuns?.length || 0;
      const pendingVendorApprovals = pendingVendors?.length || 0;
      const pendingLeaveApprovals = leaveRequests?.length || 0;
      const totalPendingApprovals = pendingPOApprovals + pendingPayrollApprovals + pendingVendorApprovals + pendingLeaveApprovals;

      // Top Performing Sales User (by revenue)
      const salesByUser = new Map<string, number>();
      (salesOrders || []).forEach((order: any) => {
        if (order.created_by) {
          salesByUser.set(order.created_by, (salesByUser.get(order.created_by) || 0) + (order.order_value || 0));
        }
      });
      
      let topPerformingSalesUser = null;
      if (salesByUser.size > 0) {
        const topUserId = [...salesByUser.entries()].sort((a, b) => b[1] - a[1])[0];
        const profile = (profiles as any[] || []).find((p: any) => p.id === topUserId[0]);
        if (profile) {
          topPerformingSalesUser = {
            name: profile.full_name,
            revenue: topUserId[1],
            conversion: 0, // Would need more data to calculate
          };
        }
      }

      // Top Performing Office
      const salesByOffice = new Map<string, number>();
      (salesOrders || []).forEach((order: any) => {
        if (order.created_by) {
          const profile = (profiles as any[] || []).find((p: any) => p.id === order.created_by);
          if (profile?.office_id) {
            salesByOffice.set(profile.office_id, (salesByOffice.get(profile.office_id) || 0) + (order.order_value || 0));
          }
        }
      });

      let topPerformingOffice = null;
      if (salesByOffice.size > 0) {
        const topOfficeId = [...salesByOffice.entries()].sort((a, b) => b[1] - a[1])[0];
        const office = (offices as any[] || []).find((o: any) => o.id === topOfficeId[0]);
        if (office) {
          topPerformingOffice = {
            name: office.name,
            revenue: topOfficeId[1],
          };
        }
      }

      // Strategic Alerts Count
      const criticalAlerts = (highRiskCustomers?.filter(c => 
        c.paymentRiskScore >= 80 || c.intentClassification === 'drop_risk'
      ).length || 0) + (deadStockAlerts?.filter(s => s.deadStockRisk >= 80).length || 0);

      const warningAlerts = (highRiskCustomers?.length || 0) + (deadStockAlerts?.length || 0) - criticalAlerts;

      const stats: DecisionDeckStats = {
        ...customerStats,
        ...skuStats,
        currentCashBalance: mtdCashInflow - mtdCashOutflow, // Simplified
        mtdCashInflow,
        mtdCashOutflow,
        receivablesTotal,
        receivables0to15,
        receivables16to30,
        receivables31to60,
        receivables60Plus,
        payablesTotal: 0, // Would need supplier invoice data
        mtdRevenue,
        mtdExpenses: mtdCashOutflow,
        ytdRevenue,
        ytdExpenses: 0, // Would need more data
        pendingPOApprovals,
        pendingPayrollApprovals,
        pendingVendorApprovals,
        pendingLeaveApprovals,
        totalPendingApprovals,
        topPerformingSalesUser,
        topPerformingOffice,
        criticalAlerts,
        warningAlerts,
      };

      return stats;
    },
    enabled: !!customerIntelligence && !!skuIntelligence,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for executive alerts
export function useExecutiveAlerts() {
  const { data: highRiskCustomers } = useHighRiskCustomers();
  const { data: deadStockAlerts } = useDeadStockAlerts();
  const { data: customerIntelligence } = useCustomerIntelligence();
  const { data: skuIntelligence } = useSKUIntelligence();

  return useQuery({
    queryKey: ['executive-alerts', highRiskCustomers?.length, deadStockAlerts?.length],
    queryFn: async () => {
      const alerts: Array<{
        id: string;
        type: 'critical' | 'warning' | 'info';
        category: 'customer' | 'sku' | 'financial' | 'performance';
        title: string;
        description: string;
        metric?: number;
        entityId?: string;
        entityName?: string;
      }> = [];

      // Customer alerts
      highRiskCustomers?.forEach(customer => {
        if (customer.intentClassification === 'drop_risk') {
          alerts.push({
            id: `customer-drop-${customer.customerId}`,
            type: 'critical',
            category: 'customer',
            title: 'Customer Drop Risk',
            description: `${customer.companyName} has low buying intent (${customer.buyingIntentScore})`,
            metric: customer.buyingIntentScore,
            entityId: customer.customerId,
            entityName: customer.companyName,
          });
        }

        if (customer.priceSensitivityClassification === 'price_driven' && customer.priceLossValue > 100000) {
          alerts.push({
            id: `customer-price-${customer.customerId}`,
            type: 'warning',
            category: 'customer',
            title: 'High Price Loss Customer',
            description: `${customer.companyName} has ₹${(customer.priceLossValue / 100000).toFixed(1)}L in price-related losses`,
            metric: customer.priceLossRate,
            entityId: customer.customerId,
            entityName: customer.companyName,
          });
        }

        if (customer.paymentRiskScore >= 70) {
          alerts.push({
            id: `customer-payment-${customer.customerId}`,
            type: customer.paymentRiskScore >= 85 ? 'critical' : 'warning',
            category: 'customer',
            title: 'Payment Risk Alert',
            description: `${customer.companyName} has high payment risk score (${customer.paymentRiskScore})`,
            metric: customer.paymentRiskScore,
            entityId: customer.customerId,
            entityName: customer.companyName,
          });
        }

        if (customer.fatigueClassification === 'exploitative') {
          alerts.push({
            id: `customer-fatigue-${customer.customerId}`,
            type: 'warning',
            category: 'customer',
            title: 'Quote Fatigue Alert',
            description: `${customer.companyName} has excessive quote requests (${customer.quotationFatigueIndex.toFixed(1)}x ratio)`,
            metric: customer.quotationFatigueIndex,
            entityId: customer.customerId,
            entityName: customer.companyName,
          });
        }
      });

      // SKU alerts
      deadStockAlerts?.forEach(sku => {
        if (sku.deadStockRisk >= 70) {
          alerts.push({
            id: `sku-deadstock-${sku.productId}`,
            type: sku.deadStockRisk >= 85 ? 'critical' : 'warning',
            category: 'sku',
            title: 'Dead Stock Risk',
            description: `${sku.productName} has high dead stock risk (${sku.deadStockRisk})`,
            metric: sku.deadStockRisk,
            entityId: sku.productId,
            entityName: sku.productName,
          });
        }

        if (sku.momentumClassification === 'liquidate_avoid' && sku.currentStock > 0) {
          alerts.push({
            id: `sku-liquidate-${sku.productId}`,
            type: 'warning',
            category: 'sku',
            title: 'SKU Momentum Decline',
            description: `${sku.productName} momentum is declining (${sku.orderVelocityChange.toFixed(0)}% change)`,
            metric: sku.skuMomentumIndex,
            entityId: sku.productId,
            entityName: sku.productName,
          });
        }
      });

      // Sort by type priority
      const typePriority = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

      return alerts;
    },
    enabled: !!highRiskCustomers || !!deadStockAlerts,
    staleTime: 5 * 60 * 1000,
  });
}
