import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ArrowRight, Hourglass, Inbox, RotateCcw, FileText, Phone, ShoppingCart } from 'lucide-react';
import {
  type SptInboxLead,
  type DealStage,
  slaStatus,
  sourceBadgeMeta,
  formatINRShort,
} from '@/hooks/useSptInbox';
import { getSegmentConfig } from '@/lib/segment-config';
import { cn } from '@/lib/utils';

interface Props {
  leads: SptInboxLead[];
  isLoading: boolean;
  showOwner?: boolean;
  currentPage: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
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

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function firstName(name: string | null) {
  if (!name) return '';
  return name.split(' ')[0];
}

interface ActionMeta {
  label: string;
  icon: typeof ArrowRight;
  variant: 'default' | 'outline' | 'secondary';
  disabled?: boolean;
  tooltip?: string;
}

function getStageAction(lead: SptInboxLead): ActionMeta {
  const stage: DealStage = lead.deal_stage;

  // Pricing — special-case awaiting
  if (stage === 'pricing' && lead.pricing_summary.mode === 'awaiting') {
    return {
      label: 'Awaiting Price',
      icon: Hourglass,
      variant: 'outline',
      disabled: true,
      tooltip: `Procurement working on ${lead.pricing_summary.pending} item${lead.pricing_summary.pending > 1 ? 's' : ''}.`,
    };
  }

  switch (stage) {
    case 'new':
      return { label: 'Open', icon: ArrowRight, variant: 'default' };
    case 'pricing':
      return { label: 'Generate Quote', icon: FileText, variant: 'default' };
    case 'negotiation':
      return { label: 'Follow Up', icon: Phone, variant: 'outline' };
    case 'follow_up':
      return { label: 'Follow Up', icon: Phone, variant: 'default' };
    case 'won':
      return { label: 'Create Order', icon: ShoppingCart, variant: 'default' };
    case 'lost':
      return { label: 'Reopen', icon: RotateCcw, variant: 'outline' };
    default:
      return { label: 'Open', icon: ArrowRight, variant: 'outline' };
  }
}

export function SptInboxListTable({
  leads,
  isLoading,
  showOwner = false,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const navigate = useNavigate();
  const totalCount = leads.length;
  const start = currentPage * pageSize;
  const pageLeads = leads.slice(start, start + pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <Card className="p-12 text-center">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No leads match the current filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28px]"></TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="w-[140px]">Source</TableHead>
              <TableHead className="w-[110px]">Value</TableHead>
              <TableHead className="w-[130px]">Age</TableHead>
              {showOwner && <TableHead className="w-[150px]">Owner</TableHead>}
              <TableHead className="text-right w-[170px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageLeads.map((lead) => {
              const sla = slaStatus(lead.hours_since_handoff);
              const src = sourceBadgeMeta(lead.source);
              const c = lead.customer;
              const action = getStageAction(lead);
              const ActionIcon = action.icon;
              const seg = c?.segment ? getSegmentConfig(c.segment) : null;

              const ageBase =
                (lead.deal_stage === 'follow_up' || lead.deal_stage === 'negotiation') &&
                lead.latest_quotation?.sent_at
                  ? new Date(lead.latest_quotation.sent_at)
                  : new Date(lead.handoff_at);

              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/leads/${lead.id}?from=/spt-inbox`)}
                >
                  <TableCell>
                    <span
                      title={slaLabel[sla]}
                      className={cn('inline-block h-2.5 w-2.5 rounded-full', slaColor[sla])}
                    />
                  </TableCell>

                  {/* Smart customer cell: name + segment badge + contact */}
                  <TableCell className="max-w-[320px]">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {c?.company_name || lead.title}
                        </span>
                        {seg && (
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0 h-4 font-semibold', seg.badgeClass)}
                          >
                            {seg.label}
                          </Badge>
                        )}
                      </div>
                      {c?.contact_person && (
                        <span className="text-xs text-muted-foreground truncate">
                          {c.contact_person}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', src.className)}>
                      {src.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className={cn('text-sm font-semibold', lead.value == null && 'text-muted-foreground font-normal')}>
                      {formatINRShort(lead.value)}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(ageBase, { addSuffix: true })}
                  </TableCell>

                  {showOwner && (
                    <TableCell>
                      {lead.owner_name ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                              {getInitials(lead.owner_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{firstName(lead.owner_name)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                  )}

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {action.disabled ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant={action.variant} disabled className="pointer-events-none opacity-60">
                                <ActionIcon className="h-3.5 w-3.5 mr-1" /> {action.label}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{action.tooltip}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        size="sm"
                        variant={action.variant}
                        onClick={() => navigate(`/leads/${lead.id}?from=/spt-inbox`)}
                      >
                        <ActionIcon className="h-3.5 w-3.5 mr-1" />
                        {action.label}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[50, 100, 200]}
      />
    </div>
  );
}
