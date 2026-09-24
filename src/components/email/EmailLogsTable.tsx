import { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, ExternalLink, Mail, CheckCircle, Eye, MousePointer, XCircle, AlertTriangle } from 'lucide-react';
import type { EmailLog, EmailLogFilters } from '@/hooks/useAllEmailLogs';

interface EmailLogsTableProps {
  logs: EmailLog[] | undefined;
  isLoading: boolean;
  filters: EmailLogFilters;
  onFiltersChange: (filters: EmailLogFilters) => void;
}

const statusConfig: Record<string, { icon: React.ElementType; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { icon: Mail, label: 'Sent', variant: 'secondary' },
  delivered: { icon: CheckCircle, label: 'Delivered', variant: 'default' },
  opened: { icon: Eye, label: 'Opened', variant: 'default' },
  clicked: { icon: MousePointer, label: 'Clicked', variant: 'default' },
  bounced: { icon: XCircle, label: 'Bounced', variant: 'destructive' },
  complained: { icon: AlertTriangle, label: 'Complained', variant: 'destructive' },
};

export function EmailLogsTable({ logs, isLoading, filters, onFiltersChange }: EmailLogsTableProps) {
  const navigate = useNavigate();

  const getStatusBadge = (log: EmailLog) => {
    // Determine the most relevant status
    let status = log.status;
    if (log.clicked_at) status = 'clicked';
    else if (log.opened_at) status = 'opened';
    else if (log.bounced_at) status = 'bounced';
    else if (log.complained_at) status = 'complained';
    else if (log.delivered_at) status = 'delivered';

    const config = statusConfig[status] || statusConfig.sent;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getEngagementIndicators = (log: EmailLog) => {
    const indicators = [];
    
    if (log.delivered_at) {
      indicators.push(
        <Tooltip key="delivered">
          <TooltipTrigger>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </TooltipTrigger>
          <TooltipContent>
            Delivered: {format(new Date(log.delivered_at), 'PPp')}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    if (log.opened_at) {
      indicators.push(
        <Tooltip key="opened">
          <TooltipTrigger>
            <Eye className="h-4 w-4 text-purple-500" />
          </TooltipTrigger>
          <TooltipContent>
            Opened: {format(new Date(log.opened_at), 'PPp')}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    if (log.clicked_at) {
      indicators.push(
        <Tooltip key="clicked">
          <TooltipTrigger>
            <MousePointer className="h-4 w-4 text-amber-500" />
          </TooltipTrigger>
          <TooltipContent>
            Clicked: {format(new Date(log.clicked_at), 'PPp')}
          </TooltipContent>
        </Tooltip>
      );
    }

    return indicators.length > 0 ? (
      <div className="flex items-center gap-1">{indicators}</div>
    ) : (
      <span className="text-muted-foreground text-sm">—</span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="border rounded-lg">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-b-0">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient or subject..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Quotation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No emails found</p>
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.recipient_email}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.subject || '—'}
                  </TableCell>
                  <TableCell>
                    {log.quotation ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">{log.quotation.quotation_number}</p>
                        {log.quotation.customer && (
                          <p className="text-xs text-muted-foreground">
                            {log.quotation.customer.company_name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log)}
                  </TableCell>
                  <TableCell>
                    {getEngagementIndicators(log)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(log.sent_at), 'PP')}
                    <br />
                    <span className="text-xs">{format(new Date(log.sent_at), 'p')}</span>
                  </TableCell>
                  <TableCell>
                    {log.quotation?.lead_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/leads/${log.quotation!.lead_id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Quotation</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
