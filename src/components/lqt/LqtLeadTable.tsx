import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadSourceBadge } from '@/components/leads/LeadSourceBadge';
import { QualifyLeadDialog } from '@/components/leads/QualifyLeadDialog';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Cog, XCircle, Clock, Inbox, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { LqtLead, LqtTab } from '@/hooks/useLqtLeads';

interface LqtLeadTableProps {
  leads: LqtLead[];
  tab: LqtTab;
  isLoading: boolean;
}

const ROUTE_BADGE: Record<string, { label: string; icon: any; cls: string }> = {
  spt: { label: 'Sales (SPT)', icon: CheckCircle2, cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  tst: { label: 'Technical (TST)', icon: Cog, cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  discard: { label: 'Discarded', icon: XCircle, cls: 'bg-destructive/10 text-destructive' },
  nurture: { label: 'Nurture', icon: Clock, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
};

function ageHours(date: string): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
}

function slaTone(hours: number): string {
  if (hours >= 24) return 'text-destructive font-semibold';
  if (hours >= 4) return 'text-amber-600 font-medium';
  return 'text-muted-foreground';
}

export function LqtLeadTable({ leads, tab, isLoading }: LqtLeadTableProps) {
  const navigate = useNavigate();
  const [qualifyId, setQualifyId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          {tab === 'pending'
            ? 'No leads awaiting qualification. Great work!'
            : tab === 'nurture'
            ? 'No leads parked for nurture.'
            : tab === 'qualified'
            ? 'Nothing qualified in the selected range.'
            : 'No discarded leads.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Source</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-[140px]">{tab === 'pending' ? 'Received / SLA' : 'Received'}</TableHead>
              {tab !== 'pending' && <TableHead className="w-[140px]">Outcome</TableHead>}
              <TableHead className="w-[160px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const hours = ageHours(lead.created_at);
              const route = lead.qualification?.routed_to;
              const routeCfg = route ? ROUTE_BADGE[route] : null;
              return (
                <TableRow key={lead.id} className="hover:bg-muted/40">
                  <TableCell>
                    <LeadSourceBadge source={lead.source} />
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="font-medium text-sm truncate">
                      {lead.customer?.company_name || lead.title}
                    </div>
                    {lead.customer?.contact_person && (
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.customer.contact_person}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">
                      {lead.customer?.phone || '—'}
                      {lead.customer?.city && ` • ${lead.customer.city}`}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="text-sm truncate" title={lead.customer_query || lead.title}>
                      {lead.customer_query || lead.title}
                    </p>
                    {lead.suggested_assignee?.full_name && (
                      <Badge variant="outline" className="mt-1 text-[10px] h-5 bg-primary/5 text-primary border-primary/20">
                        <UserCheck className="h-2.5 w-2.5 mr-1" />
                        Account Owner: {lead.suggested_assignee.full_name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tab === 'pending' ? (
                      <div className={`text-xs ${slaTone(hours)}`}>
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </div>
                    )}
                  </TableCell>
                  {tab !== 'pending' && (
                    <TableCell>
                      {routeCfg && (
                        <Badge variant="outline" className={`border-0 ${routeCfg.cls}`}>
                          <routeCfg.icon className="h-3 w-3 mr-1" />
                          {routeCfg.label}
                        </Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant={tab === 'pending' ? 'default' : 'outline'}
                        onClick={() => setQualifyId(lead.id)}
                      >
                        {tab === 'pending' ? 'Qualify' : 'Re-route'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {qualifyId && (
        <QualifyLeadDialog
          open={!!qualifyId}
          onOpenChange={(o) => !o && setQualifyId(null)}
          leadId={qualifyId}
        />
      )}
    </>
  );
}
