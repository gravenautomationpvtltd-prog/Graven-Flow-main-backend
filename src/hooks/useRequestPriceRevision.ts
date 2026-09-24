import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { requireTenantId } from '@/utils/tenantUtils';
import { toast } from 'sonner';

export interface PriceRevisionRequest {
  /** Catalog product the sales user is quoting */
  productId?: string | null;
  /** Model number / item text shown to procurement (never customer name) */
  itemLabel: string;
  /** Expired validity date, if known */
  validUntil?: string | null;
  /** Optional target price sales wants procurement to hit */
  targetRate?: number | null;
  quantity?: number | null;
  notes?: string | null;
  leadId?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Sales-side action: when a catalog price validity has lapsed, raise a
 * procurement task (assigned to the procurement head, who redistributes)
 * asking for a target price / revised price.
 */
export function useRequestPriceRevision() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (req: PriceRevisionRequest) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();

      const { data: headId, error: headErr } = await supabase.rpc('get_procurement_head', {
        _tenant_id: tenantId,
      });
      if (headErr) throw headErr;
      if (!headId) {
        throw new Error(
          'No procurement head is configured for your organization. Ask your admin to set one.',
        );
      }

      const expiredOn = req.validUntil
        ? new Date(req.validUntil).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : null;

      const title = `Revise price: ${req.itemLabel}`.slice(0, 180);
      const description = [
        expiredOn
          ? `Catalog price validity expired on ${expiredOn}.`
          : 'Catalog price has no active validity.',
        req.quantity ? `Quantity: ${req.quantity}` : null,
        req.targetRate ? `Target price: ₹${req.targetRate.toLocaleString('en-IN')}` : null,
        req.notes ? `Notes: ${req.notes}` : null,
        'Raised from the quotation builder by sales.',
      ]
        .filter(Boolean)
        .join('\n');

      const due = new Date();
      due.setDate(due.getDate() + 2);

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          assigned_to: headId as string,
          assigned_by: user?.id ?? null,
          status: 'pending',
          priority: req.priority ?? 'high',
          due_date: due.toISOString(),
          lead_id: req.leadId ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: headId as string,
        title: 'Price revision requested',
        message: `${req.itemLabel} — ${expiredOn ? `validity expired ${expiredOn}` : 'no active validity'}`,
        type: 'price_revision_request',
        link: '/tasks',
        metadata: {
          task_id: task.id,
          product_id: req.productId ?? null,
          target_rate: req.targetRate ?? null,
        },
      });

      return task.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sent to procurement — a revision task has been created.');
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not create the procurement task');
    },
  });
}
