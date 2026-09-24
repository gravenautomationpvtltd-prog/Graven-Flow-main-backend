import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LqtStatsHeader } from '@/components/lqt/LqtStatsHeader';
import { LqtLeadTable } from '@/components/lqt/LqtLeadTable';
import { LqtDateRangeFilter } from '@/components/lqt/LqtDateRangeFilter';
import { LqtDualRoleBanner } from '@/components/lqt/LqtDualRoleBanner';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { useLqtLeads, type LqtTab, type LqtRange } from '@/hooks/useLqtLeads';
import { useLqtRealtime } from '@/hooks/useLqtRealtime';
import { Inbox, AlertTriangle, Plus } from 'lucide-react';

export default function LqtInbox() {
  useLqtRealtime();
  const [tab, setTab] = useState<LqtTab>('pending');
  const [range, setRange] = useState<LqtRange>({ preset: '30d' });
  const [showCreate, setShowCreate] = useState(false);
  const { data: leads = [], isLoading, error } = useLqtLeads(tab, range);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">LQT Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Lead Qualification Team — validate new leads and route to Sales, Technical, Nurture, or Discard.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Lead
          </Button>
          <LqtDateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      <LqtDualRoleBanner />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>LQT Inbox failed to load</AlertTitle>
          <AlertDescription>
            {(error as Error).message || 'The backend returned an error. Please refresh or contact support if this persists.'}
          </AlertDescription>
        </Alert>
      )}

      <LqtStatsHeader onSelectTab={setTab} range={range} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as LqtTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="nurture">Nurture</TabsTrigger>
          <TabsTrigger value="qualified">Qualified</TabsTrigger>
          <TabsTrigger value="discarded">Discarded</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-0">
          <LqtLeadTable leads={leads} tab={tab} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      <CreateLeadDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
