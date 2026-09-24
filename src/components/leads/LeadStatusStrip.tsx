import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  User,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  leadId: string;
}

interface LoyaltyHintData {
  loyalOwnerName: string | null;
  awaitingQualification: boolean;
}

export function LeadStatusStrip({ leadId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-status-strip', leadId],
    staleTime: 30_000,
    queryFn: async () => {
      const [leadRes, itemsRes, prRes, qRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, status, has_enquiry, assigned_to, suggested_assignee_id, customer_id, profile:profiles!leads_assigned_to_fkey(full_name), suggested:profiles!leads_suggested_assignee_id_fkey(full_name), customer:customers(assigned_sales_id, owner:profiles!customers_assigned_sales_id_fkey(full_name))')
          .eq('id', leadId)
          .maybeSingle(),
        supabase
          .from('enquiry_items')
          .select('id, pricing_status' as any)
          .eq('lead_id', leadId),
        supabase
          .from('price_requests')
          .select('id, status, tat_status, assigned_to, profile:profiles!price_requests_assigned_to_fkey(full_name)')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quotations')
          .select('id, status')
          .eq('lead_id', leadId)
          .is('deleted_at', null),
      ]);

      const items = (itemsRes.data || []) as any[];
      const pr = (prRes.data || []) as any[];
      const quotations = (qRes.data || []) as any[];

      const totalItems = items.length;
      const verified = items.filter((i) => i.pricing_status === 'verified_auto').length;
      const pending = items.filter((i) => i.pricing_status === 'pending').length;
      const updated = items.filter((i) => i.pricing_status === 'updated').length;

      const activePR = pr.find((p) => ['pending', 'in_progress'].includes(p.status));
      const escalated = pr.some((p) => ['escalated', 'critical'].includes(p.tat_status));

      let stage: string;
      if (quotations.some((q) => q.status === 'accepted')) stage = 'Won';
      else if (quotations.some((q) => q.status === 'sent')) stage = 'Quoted';
      else if (quotations.length) stage = 'Drafting Quote';
      else if (totalItems > 0) stage = 'Enquiry';
      else stage = 'Lead';

      const leadRow: any = leadRes.data || {};
      const customerOwnerId = leadRow?.customer?.assigned_sales_id ?? null;
      const customerOwnerName = leadRow?.customer?.owner?.full_name ?? null;
      const suggestedName = leadRow?.suggested?.full_name ?? null;
      const loyalOwnerName = customerOwnerName || suggestedName;
      const awaitingQualification =
        !!loyalOwnerName &&
        !!leadRow?.assigned_to &&
        ((customerOwnerId && leadRow.assigned_to !== customerOwnerId) ||
          (!customerOwnerId && leadRow.suggested_assignee_id && leadRow.assigned_to !== leadRow.suggested_assignee_id));

      return {
        stage,
        sptOwnerName: leadRow?.profile?.full_name || null,
        procurementOwnerName: (activePR as any)?.profile?.full_name || null,
        totalItems,
        verified,
        pending,
        updated,
        escalated,
        hasActivePR: !!activePR,
        loyalOwnerName,
        awaitingQualification,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-14 w-full" />;
  if (!data) return null;

  let pricingLabel = '—';
  let pricingClass = 'bg-muted text-muted-foreground';
  if (data.totalItems > 0) {
    if (data.pending === 0 && data.verified === data.totalItems) {
      pricingLabel = 'Verified (Auto)';
      pricingClass = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    } else if (data.pending === 0) {
      pricingLabel = 'Updated';
      pricingClass = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
    } else {
      pricingLabel = `${data.pending} Pending`;
      pricingClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    }
  }

  let procLabel = 'Not required';
  let procClass = 'bg-muted text-muted-foreground';
  if (data.hasActivePR) {
    procLabel = data.escalated ? 'Escalated' : 'In progress';
    procClass = data.escalated
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  } else if (data.totalItems > 0 && data.pending === 0) {
    procLabel = 'Completed';
    procClass = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Stage: <Badge variant="secondary">{data.stage}</Badge>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          Pricing:
          <Badge variant="outline" className={cn(pricingClass)}>
            {pricingLabel}
          </Badge>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
          Procurement:
          <Badge variant="outline" className={cn(procClass)}>
            {procLabel}
          </Badge>
        </span>
        {data.sptOwnerName && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              SPT: <span className="text-foreground">{data.sptOwnerName}</span>
            </span>
          </>
        )}
        {data.procurementOwnerName && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Procurement: <span className="text-foreground">{data.procurementOwnerName}</span>
            </span>
          </>
        )}
        {data.awaitingQualification && data.loyalOwnerName && (
          <>
            <span className="text-muted-foreground">·</span>
            <Badge
              variant="outline"
              className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
            >
              <Clock className="h-3 w-3 mr-1" />
              Awaiting CRO qualification — will route to {data.loyalOwnerName}
            </Badge>
          </>
        )}
        {data.escalated && (
          <Badge variant="destructive" className="ml-auto">
            <AlertTriangle className="h-3 w-3 mr-1" />
            TAT Breached
          </Badge>
        )}
      </div>
    </Card>
  );
}
