import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Search, TrendingUp, TrendingDown, Minus, Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProductPricingMetrics, type ProductPricingMetrics, type PricingSortOption } from '@/hooks/usePricingIntelligence';
import { cn } from '@/lib/utils';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { ProductPricingDetailDialog } from './ProductPricingDetailDialog';
import { RecordNegotiationDialog } from './RecordNegotiationDialog';

const sortOptions: { value: PricingSortOption; label: string }[] = [
  { value: 'most_quoted', label: 'Most Quoted' },
  { value: 'revenue', label: 'Highest Revenue' },
  { value: 'orders', label: 'Most Orders' },
  { value: 'win_rate', label: 'Best Win Rate' },
  { value: 'name', label: 'A-Z Name' },
];

export function ProductPricingTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<keyof ProductPricingMetrics>('times_quoted');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedProduct, setSelectedProduct] = useState<ProductPricingMetrics | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [activeSortOption, setActiveSortOption] = useState<PricingSortOption>('most_quoted');

  const { data, isLoading } = useProductPricingMetrics(page, pageSize, debouncedSearch, activeSortOption);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSort = (field: keyof ProductPricingMetrics) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRowClick = (product: ProductPricingMetrics) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getWinRateBadge = (rate: number) => {
    if (isNaN(rate)) return <Badge variant="outline">N/A</Badge>;
    if (rate >= 60) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{rate.toFixed(0)}%</Badge>;
    if (rate >= 40) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{rate.toFixed(0)}%</Badge>;
    if (rate > 0) return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{rate.toFixed(0)}%</Badge>;
    return <Badge variant="outline">N/A</Badge>;
  };

  const getGapIndicator = (gap: number | null) => {
    if (gap === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (gap > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (gap < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  // Sort products locally since we're paginating from the server
  const sortedProducts = [...(data?.data || [])].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Sort by:</span>
        {sortOptions.map((option) => (
          <Button
            key={option.value}
            variant={activeSortOption === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveSortOption(option.value);
              setPage(1);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {data?.totalCount?.toLocaleString() || 0} products
          </span>
          <Button onClick={() => setRecordDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Negotiation
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('times_quoted')}>
                  Quoted
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('times_won')}>
                  Won
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('times_lost')}>
                  Lost
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('win_rate')}>
                  Win Rate
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Avg Quoted</TableHead>
              <TableHead className="text-right">Avg Target</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('total_revenue')}>
                  Revenue
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No pricing data available yet. Quotations with product selections will appear here.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => (
                <TableRow 
                  key={product.product_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(product)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {product.product_name}
                  </TableCell>
                  <TableCell>{product.times_quoted}</TableCell>
                  <TableCell className="text-green-500">{product.times_won}</TableCell>
                  <TableCell className="text-red-500">{product.times_lost}</TableCell>
                  <TableCell>{getWinRateBadge(product.win_rate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.avg_initial_price)}</TableCell>
                  <TableCell className="text-right">
                    {product.avg_target_price ? formatCurrency(product.avg_target_price) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {getGapIndicator(product.avg_gap_to_target)}
                      {product.avg_gap_to_target !== null && (
                        <span className={cn(
                          product.avg_gap_to_target > 0 ? 'text-red-500' : 'text-green-500'
                        )}>
                          {formatCurrency(Math.abs(product.avg_gap_to_target))}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.total_revenue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalCount > 0 && (
        <PaginationControls
          currentPage={page}
          totalCount={data.totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">≥60%</Badge>
          <span>Good</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">40-60%</Badge>
          <span>Needs Attention</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">&lt;40%</Badge>
          <span>Focus Area</span>
        </div>
        <div className="ml-auto text-muted-foreground">
          Click on any row to view detailed information
        </div>
      </div>

      {/* Detail Dialog */}
      <ProductPricingDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        product={selectedProduct}
      />

      {/* Record Negotiation Dialog */}
      <RecordNegotiationDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
      />
    </div>
  );
}
