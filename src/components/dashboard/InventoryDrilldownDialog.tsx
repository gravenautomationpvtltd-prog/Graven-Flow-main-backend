import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
}

export function InventoryDrilldownDialog({ open, onOpenChange, dateRange }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['drilldown-inventory', search],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select('*, product:products(name, hsn_code), office:offices(name)')
        .order('quantity', { ascending: true })
        .limit(20);

      const { data, error } = await query;
      if (error) throw error;
      if (!search) return data || [];
      const s = search.toLowerCase();
      return (data || []).filter((i: any) =>
        i.product?.name?.toLowerCase().includes(s) || i.product?.hsn_code?.toLowerCase().includes(s)
      );
    },
    enabled: open,
  });

  const totalQty = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inventory Overview</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by product name or HSN code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center min-w-[120px]">
            <p className="text-xs text-muted-foreground">Items Shown</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>HSN Code</TableHead>
              <TableHead>Office</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Min Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No inventory items found</TableCell></TableRow>
            ) : items.map((item: any) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { onOpenChange(false); navigate('/inventory'); }}>
                <TableCell className="font-medium">{item.product?.name || '—'}</TableCell>
                <TableCell>{item.product?.hsn_code || '—'}</TableCell>
                <TableCell>{item.office?.name || '—'}</TableCell>
                <TableCell className={`text-right font-medium ${item.quantity <= (item.min_stock_level || 0) ? 'text-destructive' : ''}`}>{item.quantity}</TableCell>
                <TableCell className="text-right">{item.min_stock_level || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/inventory'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View Full Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
