import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';

interface RFQDistribution {
  id: string;
  sent_at: string;
  viewed_at: string | null;
  response_status: string | null;
  rfq: {
    id: string;
    rfq_number: string;
    title: string;
    category_id: string | null;
    deadline_date: string | null;
    status: string | null;
    created_at: string;
  } | null;
}

interface SupplierRFQsTableProps {
  rfqs: RFQDistribution[];
  isLoading?: boolean;
}

export function SupplierRFQsTable({ rfqs, isLoading }: SupplierRFQsTableProps) {
  const navigate = useNavigate();

  const getResponseBadge = (status: string | null, viewedAt: string | null) => {
    if (status === 'quoted') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-default">Quoted</Badge>;
    }
    if (status === 'declined') {
      return <Badge variant="destructive" className="hover:bg-destructive/90 cursor-default">Declined</Badge>;
    }
    if (viewedAt) {
      return <Badge variant="secondary" className="hover:bg-secondary/80 cursor-default">Viewed</Badge>;
    }
    return <Badge variant="outline" className="hover:bg-muted cursor-default">Pending</Badge>;
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return <Badge variant="destructive" className="ml-2">Expired</Badge>;
    }
    if (daysUntil <= 3) {
      return <Badge className="bg-orange-100 text-orange-800 ml-2">{daysUntil}d left</Badge>;
    }
    return null;
  };

  const handleRowClick = (rfqId: string | undefined) => {
    if (rfqId) {
      navigate(`/procurement/rfqs/${rfqId}`);
    }
  };

  const handleRFQNumberClick = (e: React.MouseEvent, rfqId: string | undefined) => {
    e.stopPropagation();
    if (rfqId) {
      navigate(`/procurement/rfqs/${rfqId}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RFQs Received</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>RFQs Received</CardTitle>
          <CardDescription>
            All RFQs distributed to this supplier • Click a row to view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rfqs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No RFQs received yet
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RFQ Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sent Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfqs.map((rfq) => (
                    <TableRow 
                      key={rfq.id}
                      className="cursor-pointer hover:bg-primary/5 transition-colors group"
                      onClick={() => handleRowClick(rfq.rfq?.id)}
                    >
                      <TableCell className="font-medium font-mono text-sm">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={(e) => handleRFQNumberClick(e, rfq.rfq?.id)}
                            >
                              {rfq.rfq?.rfq_number || '-'}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>View RFQ Details</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {rfq.rfq?.title || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="hover:bg-muted cursor-default">
                          {rfq.rfq?.category_id || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(rfq.sent_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {rfq.rfq?.deadline_date 
                            ? format(new Date(rfq.rfq.deadline_date), 'MMM dd, yyyy')
                            : '-'
                          }
                          {getDeadlineStatus(rfq.rfq?.deadline_date || null)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResponseBadge(rfq.response_status, rfq.viewed_at)}
                          {rfq.viewed_at && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-help">
                                  <Eye className="h-3 w-3 inline mr-1" />
                                  {format(new Date(rfq.viewed_at), 'MMM dd')}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Viewed on {format(new Date(rfq.viewed_at), 'MMM dd, yyyy HH:mm')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
