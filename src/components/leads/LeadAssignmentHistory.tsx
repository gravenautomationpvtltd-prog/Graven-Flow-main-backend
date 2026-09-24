import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowRight, UserPlus, Bot, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  leadId: string;
}

interface Row {
  id: string;
  created_at: string;
  assigned_from: string | null;
  assigned_to: string | null;
  changed_by: string | null;
  reason: string | null;
  assignment_source: string | null;
  from_profile: { full_name: string | null } | null;
  to_profile: { full_name: string | null } | null;
  actor_profile: { full_name: string | null } | null;
}

const sourceMeta: Record<string, { label: string; tone: string; icon: typeof Bot }> = {
  manual_by_cro:    { label: 'Manual · LQT',       tone: 'bg-blue-100 text-blue-800',     icon: UserPlus },
  manual_by_spt:    { label: 'Manual · SPT',       tone: 'bg-indigo-100 text-indigo-800', icon: UserPlus },
  customer_loyalty: { label: 'Customer loyalty',   tone: 'bg-amber-100 text-amber-800',   icon: Sparkles },
  lqt_round_robin:  { label: 'LQT round-robin',    tone: 'bg-purple-100 text-purple-800', icon: Bot },
  webhook_round_robin: { label: 'API · Round-robin', tone: 'bg-emerald-100 text-emerald-800', icon: Bot },
  preset_by_creator:{ label: 'Pre-assigned',       tone: 'bg-slate-100 text-slate-800',   icon: UserPlus },
  manual_reassignment: { label: 'Manual reassign', tone: 'bg-orange-100 text-orange-800', icon: RefreshCw },
  redistribution:   { label: 'Bulk redistribute',  tone: 'bg-rose-100 text-rose-800',     icon: RefreshCw },
  unassigned_no_cro_available: { label: 'Unassigned', tone: 'bg-zinc-200 text-zinc-800',  icon: Bot },
};

export function LeadAssignmentHistory({ leadId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['lead-assignment-history', leadId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('lead_assignment_history')
        .select('id, created_at, assigned_from, assigned_to, changed_by, reason, assignment_source')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const ids = Array.from(new Set(
        (rows ?? []).flatMap(r => [r.assigned_from, r.assigned_to, r.changed_by])
                    .filter((v): v is string => !!v)
      ));
      let nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name').in('id', ids);
        nameMap = new Map((profs ?? []).map(p => [p.id, p.full_name ?? 'Unknown']));
      }

      return (rows ?? []).map((r) => ({
        ...r,
        from_profile: r.assigned_from ? { full_name: nameMap.get(r.assigned_from) ?? 'Unknown' } : null,
        to_profile:   r.assigned_to   ? { full_name: nameMap.get(r.assigned_to)   ?? 'Unknown' } : null,
        actor_profile: r.changed_by   ? { full_name: nameMap.get(r.changed_by)    ?? 'Unknown' } : null,
      })) as Row[];
    },
  });

  if (isLoading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!data?.length) {
    return <div className="p-6 text-sm text-muted-foreground">No assignment history yet.</div>;
  }

  return (
    <div className="p-4 space-y-3">
      {data.map((row) => {
        const meta = row.assignment_source ? sourceMeta[row.assignment_source] : undefined;
        const Icon = meta?.icon ?? Bot;
        const fromName = row.from_profile?.full_name ?? (row.assigned_from ? 'Unknown' : '—');
        const toName = row.to_profile?.full_name ?? (row.assigned_to ? 'Unknown' : 'Unassigned');
        const actor = row.actor_profile?.full_name ?? 'System';

        return (
          <div key={row.id} className="border rounded-lg p-3 flex items-start gap-3 bg-card">
            <div className="mt-0.5 rounded-full bg-muted p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{fromName}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{toName}</span>
                {meta && <Badge className={`${meta.tone} hover:${meta.tone} border-0`}>{meta.label}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {row.reason ?? 'Assignment'} · by {actor} · {format(new Date(row.created_at), 'dd MMM yyyy, h:mm a')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
