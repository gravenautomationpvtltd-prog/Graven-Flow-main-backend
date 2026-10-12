import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadSourceBadge } from '@/components/leads/LeadSourceBadge';
import { CopyableText, CopyablePhone } from '@/components/shared/CopyableText';
import { QualifyLeadDialog } from '@/components/leads/QualifyLeadDialog';
import { LqtWorkflowModal } from '@/components/lqt/LqtWorkflowModal';
import { DeleteLeadDialog } from '@/components/lqt/DeleteLeadDialog';
import { useDeleteLqtLead } from '@/hooks/useDeleteLqtLead';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Cog, XCircle, Clock, Inbox, UserCheck, Sparkles, Trash2 } from 'lucide-react';
import { formatISTDate, formatISTTime, formatISTDateTime, formatISTRelativeTime } from '@/lib/date-utils';
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
  const { canDeleteLead } = useDeleteLqtLead();
  const [qualifyId, setQualifyId] = useState<string | null>(null);
  const [workflowLead, setWorkflowLead] = useState<LqtLead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<LqtLead | null>(null);

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
              <TableHead className="w-[220px] text-right">Action</TableHead>
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
                  <TableCell className="max-w-[220px]">
                    <div className="flex flex-col gap-0.5">
                      <CopyableText
                        text={lead.customer?.company_name || lead.title}
                        label="company name"
                        textClassName="font-medium text-sm text-foreground"
                      />
                      {lead.customer?.contact_person && (
                        <CopyableText
                          text={lead.customer.contact_person}
                          label="contact person"
                          textClassName="text-xs text-muted-foreground"
                        />
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {lead.customer?.phone ? (
                          <CopyablePhone phone={lead.customer.phone} />
                        ) : (
                          <span>—</span>
                        )}
                        {lead.customer?.city && (
                          <span className="flex items-center gap-1">
                            • <CopyableText text={lead.customer.city} label="city" textClassName="text-xs text-muted-foreground" />
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <CopyableText
                      text={lead.customer_query || lead.title}
                      label="enquiry text"
                      title={lead.customer_query || lead.title}
                      textClassName="text-sm text-foreground"
                      truncate
                      className="max-w-full"
                    />
                    {lead.suggested_assignee?.full_name && (
                      <Badge variant="outline" className="mt-1 text-[10px] h-5 bg-primary/5 text-primary border-primary/20">
                        <UserCheck className="h-2.5 w-2.5 mr-1" />
                        Account Owner: {lead.suggested_assignee.full_name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell title={formatISTDateTime(lead.created_at)}>
                    <div className="flex flex-col">
                      <span className={`text-xs ${tab === 'pending' ? slaTone(hours) : 'text-foreground font-medium'}`}>
                        {formatISTRelativeTime(lead.created_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatISTDate(lead.created_at, 'medium')}, {formatISTTime(lead.created_at)}
                      </span>
                    </div>
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
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-medium"
                        onClick={() => navigate(`/leads/${lead.id}?from=/lqt-inbox`)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 h-8 text-xs bg-primary hover:bg-primary/90"
                        onClick={() => setWorkflowLead(lead)}
                      >
                        <Sparkles className="h-3 w-3" /> Actions
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setQualifyId(lead.id)}
                      >
                        {tab === 'pending' ? 'Qualify' : 'Re-route'}
                      </Button>
                      {canDeleteLead(lead.assigned_to) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete Lead"
                          onClick={() => setLeadToDelete(lead)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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

      {workflowLead && (
        <LqtWorkflowModal
          open={!!workflowLead}
          onOpenChange={(o) => !o && setWorkflowLead(null)}
          lead={workflowLead}
          onOpenQualifyDialog={(id) => setQualifyId(id)}
          onDeleteLead={() => setLeadToDelete(workflowLead)}
        />
      )}

      <DeleteLeadDialog
        open={!!leadToDelete}
        onOpenChange={(o) => !o && setLeadToDelete(null)}
        lead={leadToDelete}
        onDeleted={() => setLeadToDelete(null)}
      />
    </>
  );
}
