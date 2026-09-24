import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ArrowRight, Package, Clock, Inbox, Zap, Hourglass, CheckCircle2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  type SptInboxLead,
  type SptInboxTab,
  type PricingMode,
  slaStatus,
  sourceBadgeMeta,
} from '@/hooks/useSptInbox';
import { cn } from '@/lib/utils';

interface Props {
  leads: SptInboxLead[];
  tab: SptInboxTab;
  isLoading: boolean;
  showOwner?: boolean;
}

const slaColor: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-destructive',
};

const slaLabel: Record<'green' | 'yellow' | 'red', string> = {
  green: 'On track',
  yellow: 'Due soon',
  red: 'Overdue',
};

function PricingBadge({ mode, pending }: { mode: PricingMode; pending: number }) {
  if (mode === 'none') return null;
  if (mode === 'fast') {
    return (
      <Badge variant="outline" className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
        <Zap className="h-3 w-3 mr-1" /> Fast Mode
      </Badge>
    );
  }
  if (mode === 'awaiting') {
    return (
      <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
        <Hourglass className="h-3 w-3 mr-1" /> Awaiting Pricing ({pending})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Pricing Updated
    </Badge>
  );
}

export function SptInboxTable({ leads, tab, isLoading, showOwner = false }: Props) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <Card className="p-12 text-center">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          {tab === 'new' && 'No new handoffs. Qualified leads from LQT/TST/CRO will appear here.'}
          {tab === 'in_progress' && 'No quotations in progress.'}
          {tab === 'awaiting' && 'No quotations awaiting customer response.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((lead) => {
        const sla = slaStatus(lead.hours_since_handoff);
        const src = sourceBadgeMeta(lead.source);
        const customer = lead.customer;

        return (
          <Card
            key={lead.id}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(`/leads/${lead.id}?from=/spt-inbox`)}
          >
            <div className="flex items-start gap-4">
              {/* SLA dot */}
              <div className="pt-1.5" title={slaLabel[sla]}>
                <div className={cn('h-2.5 w-2.5 rounded-full', slaColor[sla])} />
              </div>

              {/* Main */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-sm truncate">
                    {customer?.company_name || lead.title}
                  </h3>
                  <Badge variant="outline" className={cn('text-xs', src.className)}>
                    {src.label}
                  </Badge>
                  <PricingBadge mode={lead.pricing_summary.mode} pending={lead.pricing_summary.pending} />
                  {showOwner && lead.owner_name && (
                    <Badge variant="outline" className="text-xs bg-muted/50 border-border">
                      <User className="h-3 w-3 mr-1" />
                      {lead.owner_name}
                    </Badge>
                  )}
                  {lead.qualification?.qualifier_name && (
                    <span className="text-xs text-muted-foreground">
                      via {lead.qualification.qualifier_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {lead.item_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {lead.item_count} item{lead.item_count > 1 ? 's' : ''}
                      {lead.total_qty > 0 && ` · ${lead.total_qty} qty`}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tab === 'awaiting' && lead.latest_quotation?.sent_at
                      ? `Sent ${formatDistanceToNow(new Date(lead.latest_quotation.sent_at), { addSuffix: true })}`
                      : `Handed off ${formatDistanceToNow(new Date(lead.handoff_at), { addSuffix: true })}`}
                  </span>
                  {customer?.contact_person && (
                    <span className="truncate">{customer.contact_person}</span>
                  )}
                </div>
              </div>

              {/* CTA */}
              {tab === 'new' && lead.pricing_summary.mode === 'awaiting' ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="shrink-0 pointer-events-none opacity-60"
                        >
                          <Hourglass className="h-3.5 w-3.5 mr-1" />
                          Awaiting Price
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Procurement is working on {lead.pricing_summary.pending} item{lead.pricing_summary.pending > 1 ? 's' : ''}.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  size="sm"
                  variant={tab === 'new' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/leads/${lead.id}?from=/spt-inbox`);
                  }}
                  className="shrink-0"
                >
                  {tab === 'new' ? 'Open & Quote' : 'Open'}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
