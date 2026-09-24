import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InventoryItem } from '@/hooks/useInventory';
import { Package, AlertTriangle, MoreHorizontal, Settings2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryTableProps {
  inventory: InventoryItem[];
  isLoading: boolean;
  onAdjust: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  searchQuery?: string;
}

export function InventoryTable({ inventory, isLoading, onAdjust, onDelete, searchQuery = '' }: InventoryTableProps) {
  const filteredInventory = inventory.filter(item =>
    item.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product?.hsn_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (item.quantity <= item.min_stock_level) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading inventory...
      </div>
    );
  }

  if (filteredInventory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {searchQuery ? 'No items match your search' : 'No inventory items yet'}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>HSN Code</TableHead>
            <TableHead>Office</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Min Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Restocked</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInventory.map((item) => {
            const status = getStockStatus(item);
            const isLowStock = item.quantity <= item.min_stock_level;

            return (
              <TableRow key={item.id} className={isLowStock ? 'bg-yellow-50/50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.product?.name || 'Unknown'}</span>
                    {isLowStock && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  </div>
                </TableCell>
                <TableCell>{item.product?.hsn_code || '-'}</TableCell>
                <TableCell>{item.office?.name || '-'}</TableCell>
                <TableCell className="text-right font-medium">
                  {item.quantity} {item.product?.unit || 'Nos'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.min_stock_level}
                </TableCell>
                <TableCell>
                  <Badge className={status.color}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.last_restocked_at 
                    ? format(new Date(item.last_restocked_at), 'dd MMM yyyy')
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAdjust(item)}>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
