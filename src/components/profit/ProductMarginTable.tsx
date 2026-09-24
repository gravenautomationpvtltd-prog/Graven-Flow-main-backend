import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search } from "lucide-react";
import type { ProductMargin } from "@/hooks/useProfitAnalytics";

interface ProductMarginTableProps {
  products: ProductMargin[];
  isLoading: boolean;
}

type SortField = 'productName' | 'marginPercent' | 'marginAmount' | 'quantitySold' | 'totalProfit';
type SortOrder = 'asc' | 'desc';

export function ProductMarginTable({ products, isLoading }: ProductMarginTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('marginPercent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMarginBadge = (marginPercent: number) => {
    if (marginPercent >= 20) {
      return <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">{marginPercent.toFixed(1)}%</Badge>;
    } else if (marginPercent >= 10) {
      return <Badge className="bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">{marginPercent.toFixed(1)}%</Badge>;
    } else {
      return <Badge className="bg-red-500/20 text-red-600 hover:bg-red-500/30">{marginPercent.toFixed(1)}%</Badge>;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredProducts = products
    .filter(p => 
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.hsnCode?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No products with margin data available.</p>
          <p className="text-sm mt-1">Set purchase prices in Product Catalog to see margins.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('productName')}>
                    Product <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Selling ₹</TableHead>
                <TableHead className="text-right">Purchase ₹</TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('marginAmount')}>
                    Margin ₹ <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('marginPercent')}>
                    Margin % <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('quantitySold')}>
                    Qty Sold <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('totalProfit')}>
                    Total Profit <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.productId}>
                  <TableCell className="font-medium">{product.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{product.hsnCode || '-'}</TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="outline">{product.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(product.sellingRate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.purchasePrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.marginAmount)}</TableCell>
                  <TableCell className="text-right">{getMarginBadge(product.marginPercent)}</TableCell>
                  <TableCell className="text-right">{product.quantitySold}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={product.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(product.totalProfit)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
