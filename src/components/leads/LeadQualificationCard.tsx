import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Cog, XCircle, GitBranch, Pencil, ExternalLink } from 'lucide-react';
import { useLeadQualification, type QualificationType, type RoutingTarget } from '@/hooks/useLeadQualification';
import { useBoqByLead } from '@/hooks/useBoqs';
import { QualifyLeadDialog } from './QualifyLeadDialog';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface LeadQualificationCardProps {
  leadId: string;
}

const typeConfig: Record<QualificationType, { label: string; icon: typeof CheckCircle2; className: string }> = {
  simple: { label: 'Simple Enquiry', icon: CheckCircle2, className: 'bg-green-500/10 text-green-700 border-green-500/20' },
  technical: { label: 'Technical Enquiry', icon: Cog, className: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20' },
  invalid: { label: 'Invalid', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const routeLabels: Record<RoutingTarget, string> = {
  spt: 'Sales & Proposal Team',
  tst: 'Technical Solutions Team',
  discard: 'Discarded',
  nurture: 'Nurture queue',
};

export function LeadQualificationCard({ leadId }: LeadQualificationCardProps) {
  const { data: qualification, isLoading } = useLeadQualification(leadId);
  const { data: boq } = useBoqByLead(leadId);
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  if (!qualification) {
    return (
      <Card className="shadow-sm border-dashed border-2 border-primary/30 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Lead Qualification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            This lead has not been qualified yet. Decide how to route it.
          </p>
          <Button onClick={() => setOpen(true)} className="w-full" size="sm">
            <GitBranch className="h-4 w-4 mr-2" />
            Qualify Lead
          </Button>
        </CardContent>
        <QualifyLeadDialog open={open} onOpenChange={setOpen} leadId={leadId} />
      </Card>
    );
  }

  const cfg = typeConfig[qualification.qualification_type];
  const Icon = cfg.icon;

  return (
    <Card className="shadow-sm rounded-xl">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          Qualification
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Badge variant="outline" className={cfg.className}>
            <Icon className="h-3 w-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div><span className="font-medium text-foreground">Routed to:</span> {routeLabels[qualification.routed_to]}</div>
          {qualification.application && (
            <div><span className="font-medium text-foreground">Application:</span> {qualification.application}</div>
          )}
          {qualification.estimated_quantity != null && (
            <div><span className="font-medium text-foreground">Qty:</span> {qualification.estimated_quantity}</div>
          )}
          {qualification.estimated_timeline && (
            <div><span className="font-medium text-foreground">Timeline:</span> {qualification.estimated_timeline}</div>
          )}
          {qualification.decision_reason && (
            <div className="pt-1 border-t mt-2"><span className="font-medium text-foreground">Reason:</span> {qualification.decision_reason}</div>
          )}
          <div className="pt-1 text-[10px] opacity-70">
            Qualified {format(new Date(qualification.qualified_at), 'PP')}
          </div>
        </div>
        {boq && qualification.qualification_type === 'technical' && (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to={`/tst/boq/${boq.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open BOQ
            </Link>
          </Button>
        )}
      </CardContent>
      <QualifyLeadDialog open={open} onOpenChange={setOpen} leadId={leadId} />
    </Card>
  );
}
