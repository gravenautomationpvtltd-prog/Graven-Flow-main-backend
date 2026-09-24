import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
import { Package, TrendingUp, Trophy } from 'lucide-react';
import { ProductPerformance } from '@/hooks/useEmployeeDetailedStats';

interface EmployeeProductPerformanceProps {
  products: ProductPerformance[] | undefined;
  isLoading: boolean;
}

export function EmployeeProductPerformance({ products, isLoading }: EmployeeProductPerformanceProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No product performance data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalQuoted = products.reduce((sum, p) => sum + p.quotedCount, 0);
  const totalWon = products.reduce((sum, p) => sum + p.wonCount, 0);

  // Pagination
  const paginatedProducts = products.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Performance ({products.length} products)
        </CardTitle>
        <div className="flex gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span>Quoted: {totalQuoted}</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-green-500" />
            <span>Won: {totalWon}</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="font-medium">
                  Revenue: {formatRoundedINR(totalRevenue)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Quoted</TableHead>
                <TableHead className="text-center">Won</TableHead>
                <TableHead className="text-center">Lost</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {product.productName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{product.quotedCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-500/10 text-green-600">
                      {product.wonCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-red-500/10 text-red-600">
                      {product.lostCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress 
                        value={product.winRate} 
                        className="h-2 flex-1"
                      />
                      <span className={`text-sm font-medium ${
                        product.winRate >= 50 ? 'text-green-600' : 
                        product.winRate >= 25 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {Math.round(product.winRate)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{formatRoundedINR(product.totalRevenue)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          ₹{product.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalCount={products.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(0); }}
          pageSizeOptions={[10, 25, 50]}
        />
      </CardContent>
    </Card>
  );
}
