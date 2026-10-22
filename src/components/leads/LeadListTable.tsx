import { useNavigate, useLocation } from 'react-router-dom';
import { formatISTDate, formatISTTime, formatISTDateTime, formatISTRelativeTime } from '@/lib/date-utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadSourceBadge } from './LeadSourceBadge';
import { LeadTypeBadge } from './LeadTypeBadge';
import { EscalationBadge } from './EscalationBadge';
import { EnquiryStatusBadge } from './EnquiryStatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { CopyableText } from '@/components/shared/CopyableText';
import { Package, Clock, CheckCircle2 } from 'lucide-react';
import type { LeadWithCustomer } from '@/hooks/useLeads';
import type { Database } from '@/integrations/supabase/types';

const SCROLL_KEY = 'leads:scrollY';

type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

interface LeadListTableProps {
  leads: LeadWithCustomer[] | undefined;
  isLoading: boolean;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function LeadListTable({ 
  leads, 
  isLoading, 
  totalCount = 0,
  currentPage = 0,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
}: LeadListTableProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLeadClick = (leadId: string) => {
    // Save current scroll position
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    // Navigate with "from" param for back navigation
    const returnUrl = location.pathname + location.search;
    navigate(`/leads/${leadId}?from=${encodeURIComponent(returnUrl)}`);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!leads?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-md border border-dashed p-8 bg-muted/20">
        <p className="text-base font-medium text-foreground">No leads found</p>
        <p className="text-sm text-muted-foreground mt-1">
          No records match your current view or filter criteria. Try adjusting or resetting your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onPageChange && onPageSizeChange && (
        <PaginationControls
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enquiry</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Escalation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow 
                key={lead.id} 
                className="hover:bg-muted/40 transition-colors"
              >
                <TableCell className="font-medium max-w-[200px]">
                  <CopyableText
                    text={lead.title}
                    label="lead title"
                    truncate
                    className="max-w-[200px]"
                    textClassName="font-medium text-sm text-foreground"
                    onClickText={!lead.customer ? () => handleLeadClick(lead.id) : undefined}
                  />
                </TableCell>
                <TableCell>
                  {lead.customer ? (
                    <div className="flex flex-col gap-0.5">
                      <CopyableText
                        text={lead.customer.company_name}
                        label="company name"
                        onClickText={() => handleLeadClick(lead.id)}
                        textClassName="font-medium text-sm text-foreground"
                      />
                      {lead.customer.contact_person && (
                        <CopyableText
                          text={lead.customer.contact_person}
                          label="contact person"
                          textClassName="text-xs text-muted-foreground"
                        />
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm" title={formatISTDateTime(lead.created_at)}>
                  <div className="flex flex-col">
                    <span className="font-medium whitespace-nowrap">{formatISTDate(lead.created_at)}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatISTTime(lead.created_at)} · {formatISTRelativeTime(lead.created_at)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <LeadSourceBadge source={lead.source} />
                    <LeadTypeBadge type={lead.lead_type} />
                  </div>
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={lead.status} />
                </TableCell>
                <TableCell>
                  <EnquiryStatusBadge 
                    status={(lead as any).enquiry_status as EnquiryStatus} 
                    hasEnquiry={(lead as any).has_enquiry} 
                  />
                </TableCell>
                <TableCell>{formatCurrency(lead.estimated_value)}</TableCell>
                <TableCell>
                  {lead.assigned_user ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {getInitials(lead.assigned_user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <CopyableText
                        text={lead.assigned_user.full_name}
                        label="assignee name"
                        textClassName="text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm" title={lead.last_activity_at ? formatISTDateTime(lead.last_activity_at) : undefined}>
                  {lead.last_activity_at 
                    ? formatISTRelativeTime(lead.last_activity_at)
                    : '—'}
                </TableCell>
                <TableCell>
                  <EscalationBadge level={lead.escalation_level || 'none'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {onPageChange && onPageSizeChange && (
        <PaginationControls
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
