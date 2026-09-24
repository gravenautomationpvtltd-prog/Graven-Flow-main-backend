import { useState } from 'react';
import { useSKUIntelligence } from '@/hooks/useSKUIntelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Box, TrendingUp, TrendingDown, AlertTriangle, ChevronUp, ChevronDown, Package, Clock, LinkIcon } from 'lucide-react';

type SortField = 'skuMomentumIndex' | 'quoteVelocity' | 'orderVelocity' | 'deadStockRisk' | 'totalOrderValue' | 'supplierDependencyPct' | 'leadTimeDays';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'stock_promote' | 'maintain' | 'liquidate_avoid';

export function SKUIntelligencePanel() {
  const { data: skus, isLoading } = useSKUIntelligence();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('skuMomentumIndex');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<FilterType>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredSKUs = skus
    ?.filter(s => {
      const matchesSearch = s.productName.toLowerCase().includes(search.toLowerCase()) ||
                           (s.brand?.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter = filter === 'all' || s.momentumClassification === filter;
      return matchesSearch && matchesFilter;
    })
    ?.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }) || [];

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const getMomentumBadge = (classification: string) => {
    switch (classification) {
      case 'stock_promote': return <Badge className="bg-green-500 hover:bg-green-600">Stock & Promote</Badge>;
      case 'maintain': return <Badge className="bg-amber-500 hover:bg-amber-600">Maintain</Badge>;
      case 'liquidate_avoid': return <Badge variant="destructive">Liquidate/Avoid</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getDeadStockBadge = (classification: string) => {
    switch (classification) {
      case 'low_risk': return <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Low Risk</Badge>;
      case 'medium_risk': return <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Medium</Badge>;
      case 'high_risk': return <Badge variant="outline" className="text-destructive border-destructive text-xs">High Risk</Badge>;
      default: return null;
    }
  };

  const getSupplierDependencyIndicator = (pct: number) => {
    if (pct >= 80) return <span className="text-destructive font-medium">{pct}%</span>;
    if (pct >= 50) return <span className="text-amber-600">{pct}%</span>;
    return <span className="text-green-600">{pct}%</span>;
  };

  const getLeadTimeIndicator = (days: number) => {
    if (days >= 21) return <span className="text-destructive font-medium">{days}d</span>;
    if (days >= 14) return <span className="text-amber-600">{days}d</span>;
    if (days > 0) return <span className="text-green-600">{days}d</span>;
    return <span className="text-muted-foreground">-</span>;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  const stockPromote = skus?.filter(s => s.momentumClassification === 'stock_promote').length || 0;
  const maintain = skus?.filter(s => s.momentumClassification === 'maintain').length || 0;
  const liquidate = skus?.filter(s => s.momentumClassification === 'liquidate_avoid').length || 0;
  const highDeadStockRisk = skus?.filter(s => s.deadStockClassification === 'high_risk').length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Box className="h-4 w-4" />
              <span className="text-sm">Total SKUs</span>
            </div>
            <p className="text-2xl font-bold">{skus?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Stock & Promote</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stockPromote}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-sm">Maintain</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{maintain}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Liquidate/Avoid</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{liquidate}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Dead Stock Risk</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{highDeadStockRisk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All SKUs
        </Button>
        <Button
          variant={filter === 'stock_promote' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('stock_promote')}
          className="gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Stock & Promote
        </Button>
        <Button
          variant={filter === 'maintain' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('maintain')}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Maintain
        </Button>
        <Button
          variant={filter === 'liquidate_avoid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('liquidate_avoid')}
          className="gap-2"
        >
          <TrendingDown className="h-4 w-4" />
          Liquidate/Avoid
        </Button>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-primary" />
                SKU Intelligence Matrix
              </CardTitle>
              <CardDescription>Product performance analysis with momentum scoring</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <SortHeader field="skuMomentumIndex" label="Momentum" />
                  <SortHeader field="quoteVelocity" label="Quotes/mo" />
                  <SortHeader field="orderVelocity" label="Orders/mo" />
                  <TableHead className="text-center">Customers</TableHead>
                  <SortHeader field="totalOrderValue" label="Order Value" />
                  <SortHeader field="supplierDependencyPct" label="Supplier Dep." />
                  <SortHeader field="leadTimeDays" label="Lead Time" />
                  <SortHeader field="deadStockRisk" label="Dead Stock" />
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSKUs.slice(0, 50).map((sku) => (
                  <TableRow 
                    key={sku.productId}
                    className={`
                      ${sku.momentumClassification === 'stock_promote' ? 'bg-green-500/5' :
                        sku.momentumClassification === 'liquidate_avoid' ? 'bg-destructive/5' : ''}
                    `}
                  >
                    <TableCell className="font-medium max-w-48 truncate sticky left-0 bg-background">
                      {sku.productName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sku.brand || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{sku.category || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sku.skuMomentumIndex >= 70 && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {sku.skuMomentumIndex < 40 && <TrendingDown className="h-4 w-4 text-destructive" />}
                        <span className={
                          sku.skuMomentumIndex >= 70 ? 'text-green-600 font-bold' :
                          sku.skuMomentumIndex >= 40 ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                        }>
                          {sku.skuMomentumIndex.toFixed(0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{sku.quoteCount30Days}</TableCell>
                    <TableCell className="text-center">{sku.orderCount30Days}</TableCell>
                    <TableCell className="text-center">{sku.customerSpread}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sku.totalOrderValue)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                        {getSupplierDependencyIndicator(sku.supplierDependencyPct)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {getLeadTimeIndicator(sku.leadTimeDays)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={
                          sku.deadStockRisk >= 70 ? 'text-destructive' :
                          sku.deadStockRisk >= 40 ? 'text-amber-600' : 'text-green-600'
                        }>
                          {sku.deadStockRisk.toFixed(0)}%
                        </span>
                        {getDeadStockBadge(sku.deadStockClassification)}
                      </div>
                    </TableCell>
                    <TableCell>{getMomentumBadge(sku.momentumClassification)}</TableCell>
                  </TableRow>
                ))}
                {filteredSKUs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredSKUs.length > 50 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing top 50 of {filteredSKUs.length} products
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
