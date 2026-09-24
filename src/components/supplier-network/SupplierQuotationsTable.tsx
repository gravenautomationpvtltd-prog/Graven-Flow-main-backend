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
import { ChevronRight, ExternalLink } from 'lucide-react';

interface SupplierQuotation {
  id: string;
  quotation_number: string;
  rfq_id: string;
  total_original: number | null;
  quoted_currency: string | null;
  lead_time_days: number | null;
  validity_days: number | null;
  status: string | null;
  submitted_at: string;
  notes: string | null;
  rfq: {
    rfq_number: string;
    title: string;
  } | null;
}

interface SupplierQuotationsTableProps {
  quotations: SupplierQuotation[];
  isLoading?: boolean;
}

export function SupplierQuotationsTable({ quotations, isLoading }: SupplierQuotationsTableProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'shortlisted':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-default">Shortlisted</Badge>;
      case 'accepted':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-default">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="hover:bg-destructive/90 cursor-default">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="hover:bg-secondary/80 cursor-default">Pending Review</Badge>;
      default:
        return <Badge variant="outline" className="hover:bg-muted cursor-default">{status || 'Submitted'}</Badge>;
    }
  };

  const handleRowClick = (quotationId: string) => {
    navigate(`/procurement/quotations/${quotationId}`);
  };

  const handleQuoteNumberClick = (e: React.MouseEvent, quotationId: string) => {
    e.stopPropagation();
    navigate(`/procurement/quotations/${quotationId}`);
  };

  const handleRFQClick = (e: React.MouseEvent, rfqId: string) => {
    e.stopPropagation();
    navigate(`/procurement/rfqs/${rfqId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quotations Submitted</CardTitle>
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

  // Calculate summary stats
  const totalQuotes = quotations.length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.total_original || 0), 0);
  const acceptedQuotes = quotations.filter(q => q.status === 'accepted' || q.status === 'shortlisted').length;
  const avgLeadTime = quotations.filter(q => q.lead_time_days).length > 0
    ? quotations.filter(q => q.lead_time_days).reduce((sum, q) => sum + (q.lead_time_days || 0), 0) / quotations.filter(q => q.lead_time_days).length
    : 0;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quotations Submitted</CardTitle>
              <CardDescription>
                All quotations from this supplier • Click a row to view details
              </CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help hover:bg-muted p-2 rounded-lg transition-colors">
                    <p className="text-2xl font-bold">{totalQuotes}</p>
                    <p className="text-muted-foreground">Total</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total quotations submitted</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help hover:bg-muted p-2 rounded-lg transition-colors">
                    <p className="text-2xl font-bold text-green-600">{acceptedQuotes}</p>
                    <p className="text-muted-foreground">Won</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Accepted or shortlisted quotes</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help hover:bg-muted p-2 rounded-lg transition-colors">
                    <p className="text-2xl font-bold">{avgLeadTime.toFixed(0)}d</p>
                    <p className="text-muted-foreground">Avg Lead</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Average lead time in days</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No quotations submitted yet
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quote) => (
                    <TableRow 
                      key={quote.id}
                      className="cursor-pointer hover:bg-primary/5 transition-colors group"
                      onClick={() => handleRowClick(quote.id)}
                    >
                      <TableCell className="font-medium font-mono text-sm">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={(e) => handleQuoteNumberClick(e, quote.id)}
                            >
                              {quote.quotation_number}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>View Quotation Details</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="secondary" 
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-mono"
                                onClick={(e) => handleRFQClick(e, quote.rfq_id)}
                              >
                                {quote.rfq?.rfq_number}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>View RFQ</TooltipContent>
                          </Tooltip>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px] mt-1">
                            {quote.rfq?.title}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help hover:text-primary transition-colors">
                              {quote.total_original 
                                ? `${quote.quoted_currency || 'INR'} ${quote.total_original.toLocaleString()}`
                                : '-'
                              }
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {quote.total_original 
                              ? `${quote.quoted_currency || 'INR'} ${quote.total_original.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                              : 'No amount specified'
                            }
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {quote.lead_time_days ? `${quote.lead_time_days} days` : '-'}
                      </TableCell>
                      <TableCell>
                        {quote.validity_days ? `${quote.validity_days} days` : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(quote.status)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.submitted_at), 'MMM dd, yyyy')}
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
