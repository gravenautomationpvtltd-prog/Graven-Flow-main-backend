import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
}

export function LowStockDrilldownDialog({ open, onOpenChange, dateRange }: Props) {
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['drilldown-low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, product:products(name, hsn_code), office:offices(name)')
        .order('quantity', { ascending: true })
        .limit(30);

      if (error) throw error;
      return (data || []).filter((item: any) => item.quantity <= (item.min_stock_level || 0));
    },
    enabled: open,
  });

  const criticalCount = items.filter((i: any) => i.quantity === 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Low Stock Alerts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Low Stock Items</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <p className="text-xs text-muted-foreground">Out of Stock</p>
            <p className="text-lg font-bold text-destructive">{criticalCount}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>HSN Code</TableHead>
              <TableHead>Office</TableHead>
              <TableHead className="text-right">Current Qty</TableHead>
              <TableHead className="text-right">Min Level</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No low stock items</TableCell></TableRow>
            ) : items.map((item: any) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { onOpenChange(false); navigate('/inventory'); }}>
                <TableCell className="font-medium">{item.product?.name || '—'}</TableCell>
                <TableCell>{item.product?.hsn_code || '—'}</TableCell>
                <TableCell>{item.office?.name || '—'}</TableCell>
                <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                <TableCell className="text-right">{item.min_stock_level || 0}</TableCell>
                <TableCell>
                  {item.quantity === 0 ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800" variant="secondary">Low</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/inventory'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
