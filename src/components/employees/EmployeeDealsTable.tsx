import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { formatRoundedINR } from '@/lib/currency-utils';
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
import { Trophy, XCircle, ExternalLink, Package } from 'lucide-react';
import { DealDetail } from '@/hooks/useEmployeeDetailedStats';

interface EmployeeDealsTableProps {
  deals: DealDetail[] | undefined;
  isLoading: boolean;
  initialFilter?: 'all' | 'won' | 'lost';
}

export function EmployeeDealsTable({ deals, isLoading, initialFilter = 'all' }: EmployeeDealsTableProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'won' | 'lost'>(initialFilter);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Update filter when initialFilter changes (from parent click)
  useEffect(() => {
    setFilter(initialFilter);
    setCurrentPage(0);
  }, [initialFilter]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const filteredDeals = deals?.filter(deal => {
    if (filter === 'all') return true;
    return deal.outcome === filter;
  }) || [];

  const wonCount = deals?.filter(d => d.outcome === 'won').length || 0;
  const lostCount = deals?.filter(d => d.outcome === 'lost').length || 0;

  // Pagination
  const paginatedDeals = filteredDeals.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter as typeof filter);
    setCurrentPage(0);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>All Deals ({deals?.length || 0})</CardTitle>
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">All ({deals?.length || 0})</TabsTrigger>
            <TabsTrigger value="won" className="text-green-600">
              Won ({wonCount})
            </TabsTrigger>
            <TabsTrigger value="lost" className="text-red-600">
              Lost ({lostCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {filteredDeals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No deals found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Quote Value</TableHead>
                    <TableHead className="text-right">Order Value</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Closed Date</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeals.map((deal) => (
                    <TableRow 
                      key={deal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/leads/${deal.leadId}`)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {deal.leadTitle}
                      </TableCell>
                      <TableCell>{deal.customerName}</TableCell>
                      <TableCell>
                        {deal.outcome === 'won' ? (
                          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                            <Trophy className="h-3 w-3 mr-1" />
                            Won
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">
                            <XCircle className="h-3 w-3 mr-1" />
                            Lost
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{deal.reasonLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatRoundedINR(deal.quotationValue)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              ₹{deal.quotationValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        {deal.outcome === 'won' ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-green-600 font-medium">
                                  {formatRoundedINR(deal.orderValue)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                ₹{deal.orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.products.length > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{deal.products.length} items</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <ul className="text-sm space-y-1">
                                  {deal.products.slice(0, 5).map((p, i) => (
                                    <li key={i}>• {p}</li>
                                  ))}
                                  {deal.products.length > 5 && (
                                    <li>... and {deal.products.length - 5} more</li>
                                  )}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(deal.closedDate), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${deal.leadId}`);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalCount={filteredDeals.length}
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
