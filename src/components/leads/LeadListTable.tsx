import { useNavigate, useLocation } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
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
import { EscalationBadge } from './EscalationBadge';
import { EnquiryStatusBadge } from './EnquiryStatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No leads found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first lead to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleLeadClick(lead.id)}
              >
                <TableCell className="font-medium max-w-[200px] truncate">
                  {lead.title}
                </TableCell>
                <TableCell>
                  {lead.customer ? (
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{lead.customer.company_name}</span>
                      {lead.customer.contact_person && (
                        <span className="text-xs text-muted-foreground">
                          {lead.customer.contact_person}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(lead.created_at), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>
                  <LeadSourceBadge source={lead.source} />
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
                      <span className="text-sm">{lead.assigned_user.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {lead.last_activity_at 
                    ? formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })
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
