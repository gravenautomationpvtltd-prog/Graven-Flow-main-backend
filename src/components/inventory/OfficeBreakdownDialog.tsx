import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Package, TrendingUp, IndianRupee } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OfficeBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterByOffice: (officeId: string | undefined) => void;
}

export function OfficeBreakdownDialog({ open, onOpenChange, onFilterByOffice }: OfficeBreakdownDialogProps) {
  const { data: inventory = [] } = useInventory();
  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name, location').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Calculate office stats
  const officeStats = offices.map(office => {
    const officeInventory = inventory.filter(i => i.office_id === office.id);
    const skuCount = officeInventory.length;
    const totalUnits = officeInventory.reduce((sum, i) => sum + i.quantity, 0);
    const stockValue = officeInventory.reduce((sum, i) => sum + (i.quantity * (i.product?.default_rate || 0)), 0);
    const lowStockCount = officeInventory.filter(i => i.quantity <= (i.min_stock_level || 0)).length;

    return {
      id: office.id,
      name: office.name,
      location: office.location,
      skuCount,
      totalUnits,
      stockValue,
      lowStockCount,
    };
  });

  // Chart data for comparison
  const comparisonData = officeStats.map(o => ({
    name: o.name,
    SKUs: o.skuCount,
    Units: o.totalUnits,
  }));

  const valueComparisonData = officeStats.map(o => ({
    name: o.name,
    value: o.stockValue,
  }));

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const handleViewOffice = (officeId: string) => {
    onFilterByOffice(officeId);
    onOpenChange(false);
  };

  const totalValue = officeStats.reduce((sum, o) => sum + o.stockValue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Office Inventory Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Office Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {officeStats.map((office) => (
              <div 
                key={office.id} 
                className="border rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{office.name}</h3>
                    <span className="text-xs text-muted-foreground capitalize">{office.location}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewOffice(office.id)}
                  >
                    View Inventory
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Package className="h-3 w-3" />
                      <span className="text-xs">SKUs</span>
                    </div>
                    <div className="text-xl font-bold">{office.skuCount}</div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs">Units</span>
                    </div>
                    <div className="text-xl font-bold">{office.totalUnits.toLocaleString()}</div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <IndianRupee className="h-3 w-3" />
                      <span className="text-xs">Stock Value</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">{formatCurrency(office.stockValue)}</div>
                    <div className="text-xs text-muted-foreground">
                      {totalValue > 0 ? ((office.stockValue / totalValue) * 100).toFixed(1) : 0}% of total
                    </div>
                  </div>
                </div>

                {office.lowStockCount > 0 && (
                  <div className="mt-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2 text-center">
                    <span className="text-sm text-yellow-700 dark:text-yellow-400">
                      ⚠️ {office.lowStockCount} items low on stock
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Comparison Charts */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">SKUs & Units Comparison</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="SKUs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Units" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Value Distribution</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                    <Tooltip formatter={(value) => [formatCurrency(value as number), 'Value']} />
                    <Bar dataKey="value" name="Stock Value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Balance Suggestion */}
          {officeStats.length >= 2 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Stock Balance Analysis</h3>
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const sorted = [...officeStats].sort((a, b) => b.stockValue - a.stockValue);
                  const diff = sorted[0].stockValue - sorted[sorted.length - 1].stockValue;
                  const diffPercent = totalValue > 0 ? ((diff / totalValue) * 100).toFixed(1) : '0';
                  
                  if (parseFloat(diffPercent) > 30) {
                    return `⚠️ ${sorted[0].name} holds ${diffPercent}% more stock value than ${sorted[sorted.length - 1].name}. Consider balancing inventory across offices.`;
                  }
                  return `✅ Stock is well-balanced across offices (${diffPercent}% variance).`;
                })()}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
