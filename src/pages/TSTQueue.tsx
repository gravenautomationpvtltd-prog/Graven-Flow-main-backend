import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useBoqs, type BoqStatus } from '@/hooks/useBoqs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Cog, ArrowRight, Clock, CheckCircle2, PauseCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_LABELS: Record<BoqStatus, { label: string; icon: typeof Cog; className: string }> = {
  draft: { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Cog, className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  ready_for_sales: { label: 'Ready for Sales', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 border-green-500/20' },
  handed_off: { label: 'Handed Off', icon: Send, className: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' },
  on_hold: { label: 'On Hold', icon: PauseCircle, className: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
};

export default function TSTQueue() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'active' | 'handed_off' | 'all'>('active');

  const statusFilter: BoqStatus[] | undefined =
    tab === 'active' ? ['draft', 'in_progress', 'on_hold', 'ready_for_sales']
    : tab === 'handed_off' ? ['handed_off']
    : undefined;

  const { data: boqs = [], isLoading } = useBoqs({ status: statusFilter });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          Technical Solutions Queue
        </h1>
        <p className="text-muted-foreground">Build BOQs and hand off completed designs to Sales.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="handed_off">Handed Off</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          {!isLoading && boqs.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No BOQs in this queue.
              </CardContent>
            </Card>
          )}
          {boqs.map((b) => {
            const cfg = STATUS_LABELS[b.status];
            const Icon = cfg.icon;
            return (
              <Card key={b.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {b.lead?.customer?.company_name || 'Unknown customer'}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.lead?.customer?.contact_person || '—'} · Created {format(new Date(b.created_at), 'PP')}
                    </p>
                  </div>
                  <Badge variant="outline" className={cfg.className}>
                    <Icon className="h-3 w-3 mr-1" />
                    {cfg.label}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-2">
                  {b.lead?.customer_query && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{b.lead.customer_query}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {b.assignee?.full_name ? <>Assigned: <span className="font-medium text-foreground">{b.assignee.full_name}</span></> : 'Unassigned'}
                    </div>
                    <Button size="sm" onClick={() => navigate(`/tst/boq/${b.id}`)}>
                      Open BOQ <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
