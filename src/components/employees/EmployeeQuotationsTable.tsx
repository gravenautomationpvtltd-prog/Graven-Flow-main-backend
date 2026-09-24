import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { formatRoundedINR } from '@/lib/currency-utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Clock, Package } from 'lucide-react';
import { useEmployeeQuotations } from '@/hooks/useEmployeeDetailedStats';
import { DateRangeParam } from '@/hooks/useEmployeeStats';

interface EmployeeQuotationsTableProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeQuotationsTable({ employeeId, dateRange }: EmployeeQuotationsTableProps) {
  const navigate = useNavigate();
  const { data: quotations, isLoading } = useEmployeeQuotations(employeeId, dateRange);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Quotations</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64" /></CardContent>
      </Card>
    );
  }

  const convertedCount = quotations?.filter(q => q.is_converted).length || 0;
  const pendingCount = (quotations?.length || 0) - convertedCount;

  const paginatedQuotations = (quotations || []).slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quotations ({quotations?.length || 0})</CardTitle>
        <div className="flex gap-2">
          <Badge className="bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Converted: {convertedCount}
          </Badge>
          <Badge className="bg-yellow-500/10 text-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pending: {pendingCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!quotations || quotations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No quotations created yet
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuotations.map((quotation) => {
                    const lead = quotation.lead as any;
                    const items = quotation.items as any[];
                    const productNames = items?.map(item => 
                      item.product?.name || item.description
                    ).filter(Boolean) || [];

                    return (
                      <TableRow 
                        key={quotation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => lead?.id && navigate(`/leads/${lead.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          {quotation.quotation_number}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {lead?.title || '-'}
                        </TableCell>
                        <TableCell>
                          {lead?.customer?.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          {productNames.length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{productNames.length} items</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <ul className="text-sm space-y-1">
                                    {productNames.slice(0, 5).map((name, i) => (
                                      <li key={i}>• {name}</li>
                                    ))}
                                    {productNames.length > 5 && (
                                      <li>... and {productNames.length - 5} more</li>
                                    )}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{formatRoundedINR(quotation.grand_total || 0)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                ₹{(quotation.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {quotation.is_converted ? (
                            <Badge className="bg-green-500/10 text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Converted
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(quotation.created_at), 'dd MMM yyyy')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalCount={quotations?.length || 0}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(0); }}
              pageSizeOptions={[10, 25, 50]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
