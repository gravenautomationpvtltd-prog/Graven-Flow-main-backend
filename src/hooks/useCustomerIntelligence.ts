import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, differenceInDays, differenceInHours } from 'date-fns';

// Types for Customer Intelligence KPIs
export interface CustomerIntelligence {
  customerId: string;
  companyName: string;
  industryTag: string | null;
  
  // Core KPIs
  buyingIntentScore: number;        // 0-100
  quotationFatigueIndex: number;    // Lower is better
  priceSensitivityScore: number;    // 0-100, higher = more price-driven
  paymentRiskScore: number;         // 0-100, higher = more risk
  priceLossRate: number;            // Percentage of quotes lost to price
  priceLossValue: number;           // Total value lost due to price
  
  // Supporting metrics
  quotesIssued90Days: number;
  ordersWon90Days: number;
  conversionRate: number;
  totalQuoteValue: number;
  totalOrderValue: number;
  avgPaymentDelayDays: number;
  followUpEngagement: number;       // Based on lead activities
  
  // Classification
  intentClassification: 'buy_likely' | 'negotiation_zone' | 'drop_risk';
  fatigueClassification: 'healthy' | 'watch' | 'exploitative';
  priceSensitivityClassification: 'value_buyer' | 'price_aware' | 'price_driven';
}

// Fetch all customer intelligence data
export function useCustomerIntelligence() {
  return useQuery({
    queryKey: ['customer-intelligence'],
    queryFn: async () => {
      const ninetyDaysAgo = subDays(new Date(), 90).toISOString();
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Fetch customers with their quotations and orders
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          company_name,
          industry_tag,
          created_at
        `);

      if (customersError) throw customersError;

      // Fetch quotations with loss reasons
      const { data: quotations, error: quotationsError } = await supabase
        .from('quotations')
        .select(`
          id,
          customer_id,
          grand_total,
          status,
          loss_reason,
          created_at,
          sent_at
        `)
        .gte('created_at', ninetyDaysAgo);

      if (quotationsError) throw quotationsError;

      // Fetch sales orders
      const { data: salesOrders, error: ordersError } = await supabase
        .from('sales_orders')
        .select(`
          id,
          customer_id,
          order_value,
          created_at,
          quotation_id
        `)
        .gte('created_at', ninetyDaysAgo);

      if (ordersError) throw ordersError;

      // Fetch customer payments for payment behavior
      const { data: payments, error: paymentsError } = await supabase
        .from('customer_payments')
        .select(`
          id,
          customer_id,
          amount,
          payment_date,
          created_at
        `);

      if (paymentsError) throw paymentsError;

      // Fetch invoices for payment delay calculation
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          customer_id,
          grand_total,
          due_date,
          amount_paid,
          status,
          created_at
        `);

      if (invoicesError) throw invoicesError;

      // Fetch lead activities for engagement scoring
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select(`
          id,
          lead_id,
          activity_type,
          created_at
        `)
        .gte('created_at', thirtyDaysAgo);

      if (activitiesError) throw activitiesError;

      // Fetch leads to map to customers
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          customer_id,
          status
        `);

      if (leadsError) throw leadsError;

      // Process each customer
      const intelligenceData: CustomerIntelligence[] = (customers || []).map(customer => {
        // Customer quotations in last 90 days
        const customerQuotations = (quotations || []).filter(q => q.customer_id === customer.id);
        const customerOrders = (salesOrders || []).filter(o => o.customer_id === customer.id);
        const customerPayments = (payments || []).filter(p => p.customer_id === customer.id);
        const customerInvoices = (invoices || []).filter(i => i.customer_id === customer.id);
        const customerLeads = (leads || []).filter(l => l.customer_id === customer.id);
        const customerLeadIds = customerLeads.map(l => l.id);
        const customerActivities = (activities || []).filter(a => customerLeadIds.includes(a.lead_id));

        // Basic metrics
        const quotesIssued90Days = customerQuotations.length;
        const ordersWon90Days = customerOrders.length;
        const totalQuoteValue = customerQuotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);
        const totalOrderValue = customerOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);
        const conversionRate = quotesIssued90Days > 0 ? (ordersWon90Days / quotesIssued90Days) * 100 : 0;

        // Price-Loss Attribution
        const priceLostQuotes = customerQuotations.filter(q => 
          q.loss_reason === 'high_price' || 
          q.loss_reason === 'budget_constraint' || 
          q.loss_reason === 'competition_lower_price'
        );
        const priceLossRate = quotesIssued90Days > 0 
          ? (priceLostQuotes.length / quotesIssued90Days) * 100 
          : 0;
        const priceLossValue = priceLostQuotes.reduce((sum, q) => sum + (q.grand_total || 0), 0);

        // Payment Behavior Analysis
        const paymentDelays: number[] = [];
        customerInvoices.forEach(invoice => {
          if (invoice.due_date && invoice.amount_paid && invoice.amount_paid > 0) {
            const payment = customerPayments.find(p => 
              Math.abs((p.amount || 0) - (invoice.amount_paid || 0)) < 1
            );
            if (payment) {
              const delayDays = differenceInDays(
                new Date(payment.payment_date),
                new Date(invoice.due_date)
              );
              paymentDelays.push(Math.max(0, delayDays));
            }
          }
        });
        const avgPaymentDelayDays = paymentDelays.length > 0 
          ? paymentDelays.reduce((a, b) => a + b, 0) / paymentDelays.length 
          : 0;

        // Quote Response Speed (hours from quote sent to any response)
        const responseSpeedScore = calculateResponseSpeedScore(customerQuotations, customerOrders);

        // Follow-up Engagement Score
        const followUpEngagement = Math.min(100, (customerActivities.length / 10) * 100);

        // Historic Conversion Ratio Score (weighted)
        const conversionScore = Math.min(100, conversionRate * 4); // 25% conversion = 100 score

        // Payment Discipline Score (inverse of delay)
        const paymentDisciplineScore = Math.max(0, 100 - (avgPaymentDelayDays * 3));

        // === BUYING INTENT SCORE (0-100) ===
        // Formula: (Quote Frequency Trend × 20) + (Customer Response Speed × 15) + 
        //          (Follow-up Engagement × 15) + (Historic Conversion Ratio × 25) + 
        //          (Payment Discipline × 15) + (Support Stability × 10)
        const quoteFrequencyTrend = Math.min(100, quotesIssued90Days * 10);
        const supportStability = 80; // Default, can be enhanced with support ticket data

        const buyingIntentScore = Math.round(
          (quoteFrequencyTrend * 0.20) +
          (responseSpeedScore * 0.15) +
          (followUpEngagement * 0.15) +
          (conversionScore * 0.25) +
          (paymentDisciplineScore * 0.15) +
          (supportStability * 0.10)
        );

        // === QUOTATION FATIGUE INDEX ===
        // Formula: Total Quotes (90 Days) ÷ Total Orders (90 Days)
        const quotationFatigueIndex = ordersWon90Days > 0 
          ? quotesIssued90Days / ordersWon90Days 
          : quotesIssued90Days > 0 ? 99 : 0;

        // === PRICE SENSITIVITY SCORE (0-100) ===
        // Formula: (Re-quote Requests × 30) + (Discount Dependency × 40) + (Delayed Closure × 30)
        const reQuoteRequests = customerQuotations.filter(q => q.status === 'revised').length;
        const reQuoteScore = Math.min(100, (reQuoteRequests / Math.max(1, quotesIssued90Days)) * 100);
        
        // Discount dependency from price loss rate
        const discountDependencyScore = priceLossRate;
        
        // Delayed closure - quotes that took long to convert
        const delayedClosureScore = calculateDelayedClosureScore(customerQuotations, customerOrders);

        const priceSensitivityScore = Math.round(
          (reQuoteScore * 0.30) +
          (discountDependencyScore * 0.40) +
          (delayedClosureScore * 0.30)
        );

        // === PAYMENT RISK SCORE (0-100) ===
        // Formula: (Past Delay Avg × 40) + (Current Credit Exposure × 30) + 
        //          (Order Size Growth Rate × 20) + (Follow-up Resistance × 10)
        const delayScore = Math.min(100, avgPaymentDelayDays * 3);
        
        // Credit exposure - unpaid invoices
        const unpaidInvoices = customerInvoices.filter(i => 
          i.status !== 'paid' && (i.grand_total || 0) > (i.amount_paid || 0)
        );
        const creditExposure = unpaidInvoices.reduce((sum, i) => 
          sum + ((i.grand_total || 0) - (i.amount_paid || 0)), 0
        );
        const creditExposureScore = Math.min(100, (creditExposure / 100000) * 100);
        
        // Order size growth (risk if growing fast without payment history)
        const orderGrowthScore = ordersWon90Days > 3 && avgPaymentDelayDays > 15 ? 50 : 0;
        
        // Follow-up resistance (inverse of engagement)
        const followUpResistance = 100 - followUpEngagement;

        const paymentRiskScore = Math.round(
          (delayScore * 0.40) +
          (creditExposureScore * 0.30) +
          (orderGrowthScore * 0.20) +
          (followUpResistance * 0.10)
        );

        // Classifications
        const intentClassification: CustomerIntelligence['intentClassification'] = 
          buyingIntentScore >= 80 ? 'buy_likely' :
          buyingIntentScore >= 50 ? 'negotiation_zone' : 'drop_risk';

        const fatigueClassification: CustomerIntelligence['fatigueClassification'] =
          quotationFatigueIndex <= 2 ? 'healthy' :
          quotationFatigueIndex <= 5 ? 'watch' : 'exploitative';

        const priceSensitivityClassification: CustomerIntelligence['priceSensitivityClassification'] =
          priceLossRate < 20 ? 'value_buyer' :
          priceLossRate <= 40 ? 'price_aware' : 'price_driven';

        return {
          customerId: customer.id,
          companyName: customer.company_name,
          industryTag: customer.industry_tag,
          buyingIntentScore,
          quotationFatigueIndex: Math.round(quotationFatigueIndex * 10) / 10,
          priceSensitivityScore,
          paymentRiskScore,
          priceLossRate: Math.round(priceLossRate * 10) / 10,
          priceLossValue,
          quotesIssued90Days,
          ordersWon90Days,
          conversionRate: Math.round(conversionRate * 10) / 10,
          totalQuoteValue,
          totalOrderValue,
          avgPaymentDelayDays: Math.round(avgPaymentDelayDays),
          followUpEngagement: Math.round(followUpEngagement),
          intentClassification,
          fatigueClassification,
          priceSensitivityClassification,
        };
      });

      // Sort by buying intent score descending
      return intelligenceData.sort((a, b) => b.buyingIntentScore - a.buyingIntentScore);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper: Calculate response speed score
function calculateResponseSpeedScore(quotations: any[], orders: any[]): number {
  const sentQuotes = quotations.filter(q => q.sent_at);
  if (sentQuotes.length === 0) return 50; // Default

  let totalResponseHours = 0;
  let respondedCount = 0;

  sentQuotes.forEach(quote => {
    const relatedOrder = orders.find(o => o.quotation_id === quote.id);
    if (relatedOrder) {
      const hours = differenceInHours(
        new Date(relatedOrder.created_at),
        new Date(quote.sent_at)
      );
      totalResponseHours += hours;
      respondedCount++;
    }
  });

  if (respondedCount === 0) return 30;

  const avgHours = totalResponseHours / respondedCount;
  // Faster response = higher score (24 hours = 100, 168 hours/week = 0)
  return Math.max(0, Math.min(100, 100 - (avgHours / 168) * 100));
}

// Helper: Calculate delayed closure score
function calculateDelayedClosureScore(quotations: any[], orders: any[]): number {
  const convertedQuotes = quotations.filter(q => 
    orders.some(o => o.quotation_id === q.id)
  );

  if (convertedQuotes.length === 0) return 50;

  let totalDays = 0;
  convertedQuotes.forEach(quote => {
    const order = orders.find(o => o.quotation_id === quote.id);
    if (order) {
      const days = differenceInDays(
        new Date(order.created_at),
        new Date(quote.created_at)
      );
      totalDays += days;
    }
  });

  const avgDays = totalDays / convertedQuotes.length;
  // Faster closure = lower score (7 days = 0, 30+ days = 100)
  return Math.min(100, Math.max(0, (avgDays - 7) / 23 * 100));
}

// Get single customer intelligence
export function useCustomerIntelligenceById(customerId: string | undefined) {
  const { data: allIntelligence, isLoading, error } = useCustomerIntelligence();
  
  const customerData = customerId 
    ? allIntelligence?.find(c => c.customerId === customerId) 
    : undefined;

  return { data: customerData, isLoading, error };
}

// Get high-risk customers (for alerts)
export function useHighRiskCustomers() {
  const { data: allIntelligence, isLoading, error } = useCustomerIntelligence();
  
  const highRisk = allIntelligence?.filter(c => 
    c.intentClassification === 'drop_risk' ||
    c.priceSensitivityClassification === 'price_driven' ||
    c.paymentRiskScore >= 70 ||
    c.fatigueClassification === 'exploitative'
  );

  return { data: highRisk, isLoading, error };
}
