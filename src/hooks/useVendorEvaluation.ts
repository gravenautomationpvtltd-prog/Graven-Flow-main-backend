import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface VendorEvaluation {
  id: string;
  rfq_id: string;
  supplier_id: string;
  quotation_id: string | null;
  price_score: number;
  delivery_score: number;
  compliance_score: number;
  performance_score: number;
  weighted_total: number;
  compliance_notes: string | null;
  is_selected: boolean;
  evaluated_by: string | null;
  created_at: string;
}

export function useVendorEvaluations(rfqId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['vendor-evaluations', rfqId],
    queryFn: async () => {
      if (!rfqId) return [];
      const { data, error } = await supabase
        .from('vendor_evaluations')
        .select('*')
        .eq('rfq_id', rfqId);
      if (error) throw error;
      return data as VendorEvaluation[];
    },
    enabled: !!rfqId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (evals: Partial<VendorEvaluation>[]) => {
      for (const ev of evals) {
        const payload = { ...ev, evaluated_by: profile?.id };
        if (ev.id) {
          const { error } = await supabase.from('vendor_evaluations').update(payload).eq('id', ev.id);
          if (error) throw error;
        } else {
          const { rfq_id, supplier_id, ...rest } = payload;
          if (!rfq_id || !supplier_id) throw new Error('rfq_id and supplier_id are required');
          const { error } = await supabase.from('vendor_evaluations').insert({
            rfq_id,
            supplier_id,
            ...rest,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-evaluations', rfqId] });
      toast.success('Evaluation saved');
    },
    onError: () => {
      toast.error('Failed to save evaluation');
    },
  });

  return { evaluations, isLoading, upsertMutation };
}

export function calculateScores(
  vendors: { totalPrice: number; deliveryDays: number | null }[]
): { priceScores: number[]; deliveryScores: number[] } {
  const prices = vendors.map((v) => v.totalPrice);
  const minPrice = Math.min(...prices);
  const priceScores = prices.map((p) => (p > 0 ? Math.round((minPrice / p) * 100) : 0));

  const deliveries = vendors.map((v) => v.deliveryDays || 999);
  const minDelivery = Math.min(...deliveries);
  const deliveryScores = deliveries.map((d) =>
    d > 0 && d < 999 ? Math.round((minDelivery / d) * 100) : 0
  );

  return { priceScores, deliveryScores };
}

export function computeWeightedTotal(scores: {
  price: number;
  delivery: number;
  compliance: number;
  performance: number;
}): number {
  return Math.round(
    scores.price * 0.5 + scores.delivery * 0.2 + scores.compliance * 0.2 + scores.performance * 0.1
  );
}
