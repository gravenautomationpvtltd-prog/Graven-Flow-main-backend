import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ComparisonTable } from '@/components/supplier-network/ComparisonTable';
import { VendorScoringPanel } from '@/components/supplier-network/VendorScoringPanel';
import { toast } from 'sonner';
import { useMemo } from 'react';

export default function RFQComparison() {
  const { id: rfqId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: rfq } = useQuery({
    queryKey: ['rfq-detail', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfqs').select('*').eq('id', rfqId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!rfqId,
  });

  const { data: rfqItems = [] } = useQuery({
    queryKey: ['rfq-items', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfq_items')
        .select('*')
        .eq('rfq_id', rfqId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!rfqId,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['supplier-quotations-for-rfq', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_quotations')
        .select(`
          *,
          suppliers!supplier_quotations_supplier_id_fkey(id, name),
          supplier_quotation_items(*)
        `)
        .eq('rfq_id', rfqId!);
      if (error) throw error;
      return data;
    },
    enabled: !!rfqId,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['supplier-ratings-avg'],
    queryFn: async () => {
      const { data } = await supabase.from('supplier_ratings').select('supplier_id, overall_rating');
      return data || [];
    },
  });

  const vendors = useMemo(() => {
    return quotations.map((q) => {
      const sqItems = q.supplier_quotation_items || [];
      const itemPrices: Record<string, number> = {};
      sqItems.forEach((i) => {
        if (i.rfq_item_id) itemPrices[i.rfq_item_id] = i.unit_price_original;
      });

      const supplierRatings = ratings.filter((r) => r.supplier_id === q.supplier_id);
      const avgRating = supplierRatings.length > 0
        ? supplierRatings.reduce((s, r) => s + (r.overall_rating || 0), 0) / supplierRatings.length
        : 3;

      const supplier = q.suppliers as unknown as { id: string; name: string } | null;

      return {
        supplierId: q.supplier_id,
        supplierName: supplier?.name || 'Unknown',
        quotationId: q.id,
        totalAmount: q.total_original || 0,
        deliveryDays: q.lead_time_days,
        itemPrices,
        avgRating,
      };
    });
  }, [quotations, ratings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/supplier-network/rfqs')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Vendor Comparison {rfq ? `— ${rfq.rfq_number}` : ''}
          </h1>
          <p className="text-muted-foreground">{rfq?.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Item-Level Price Comparison</CardTitle></CardHeader>
        <CardContent>
          <ComparisonTable items={rfqItems} vendors={vendors} currency={rfq?.base_currency || 'INR'} />
        </CardContent>
      </Card>

      <VendorScoringPanel
        vendors={vendors.map((v) => ({
          supplierId: v.supplierId,
          supplierName: v.supplierName,
          totalPrice: v.totalAmount,
          deliveryDays: v.deliveryDays,
          avgRating: v.avgRating,
        }))}
        onAward={() => {
          toast.success('Awarded to supplier. Use the existing PO workflow to proceed.');
        }}
      />
    </div>
  );
}
