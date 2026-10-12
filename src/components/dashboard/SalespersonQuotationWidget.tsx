import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, TrendingUp, Clock, RefreshCw, DollarSign, Target } from 'lucide-react';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { fetchUserAssociatedLeadIds } from '@/lib/lead-persistence';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

interface Props {
  userId: string;
  userName?: string;
  dateRange?: { from?: Date; to?: Date };
}

function useUserQuotationPerformance(userId: string, dateRange?: { from?: Date; to?: Date }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['user-quotation-performance', userId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('quotations')
        .select('id, created_at, grand_total, status, is_converted, revision_number, lead_id')
        .is('deleted_at', null)
        .neq('status', 'draft');

      const associatedLeadIds = (await fetchUserAssociatedLeadIds(userId)).slice(0, 50);
      if (associatedLeadIds.length > 0 && associatedLeadIds.length <= 50) {
        query = query.or(`created_by.eq.${userId},lead_id.in.(${associatedLeadIds.join(',')})`);
      } else {
        query = query.eq('created_by', userId);
      }

      if (dateRange?.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange?.to) query = query.lte('created_at', dateRange.to.toISOString());

      const quotationsRes = await query;
      const quotations = quotationsRes.data || [];
      const quotationLeadIds = Array.from(new Set(quotations.map(q => q.lead_id).filter(Boolean)));

      let leadMap = new Map();
      if (quotationLeadIds.length > 0) {
        const { data: leads } = await supabase
          .from('leads')
          .select('id, status, won_at, lost_reason')
          .is('deleted_at', null)
          .in('id', quotationLeadIds.slice(0, 100));
        leadMap = new Map((leads || []).map(l => [l.id, l]));
      }

      const total = quotations.length;
      const totalValue = quotations.reduce((s, q) => s + (q.grand_total || 0), 0);
      const converted = quotations.filter(q => q.is_converted);
      const conversionRate = total > 0 ? (converted.length / total) * 100 : 0;
      const revised = quotations.filter(q => (q.revision_number || 0) > 0);
      const revisionRate = total > 0 ? (revised.length / total) * 100 : 0;

      const conversionDays: number[] = [];
      converted.forEach(q => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        if (lead?.won_at) {
          const days = (new Date(lead.won_at).getTime() - new Date(q.created_at).getTime()) / (86400000);
          if (days >= 0 && days < 365) conversionDays.push(days);
        }
      });
      const avgDays = conversionDays.length > 0 ? conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length : 0;

      // Top loss reason
      const lossReasons: Record<string, number> = {};
      quotations.forEach(q => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        if (lead?.lost_reason) lossReasons[lead.lost_reason] = (lossReasons[lead.lost_reason] || 0) + 1;
      });
      const topLossReason = Object.entries(lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

      return { total, totalValue, converted: converted.length, conversionRate, avgDays, revisionRate, topLossReason };
    },
    enabled: !!userId && !!session,
    staleTime: 30_000,
    refetchOnMount: true,
  });
}

export function SalespersonQuotationWidget({ userId, userName, dateRange }: Props) {
  const { data, isLoading } = useUserQuotationPerformance(userId, dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-24" /></CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotation Performance{userName ? ` — ${userName}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No quotation data available</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: 'Quotations', value: data.total.toString(), icon: FileText, color: 'text-primary' },
    { label: 'Total Value', value: formatCurrency(data.totalValue), icon: DollarSign, color: 'text-chart-1' },
    { label: 'Converted', value: data.converted.toString(), icon: Target, color: 'text-chart-2' },
    { label: 'Conv Rate', value: `${data.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-chart-2' },
    { label: 'Avg Days', value: data.avgDays.toFixed(1), icon: Clock, color: 'text-chart-3' },
    { label: 'Revision Rate', value: `${data.revisionRate.toFixed(1)}%`, icon: RefreshCw, color: 'text-chart-5' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Quotation Performance{userName ? ` — ${userName}` : ''}
        </CardTitle>
        {data.topLossReason !== '—' && (
          <CardDescription>Top loss reason: {data.topLossReason}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <m.icon className={`h-3 w-3 ${m.color}`} />
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
              <p className="text-sm font-bold">{m.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
