import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Search, Package, AlertTriangle, TrendingUp, Building2, Plus, IndianRupee } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInventory, useLowStockItems, InventoryItem } from '@/hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { StockAdjustmentDialog } from '@/components/inventory/StockAdjustmentDialog';
import { AddInventoryDialog } from '@/components/inventory/AddInventoryDialog';
import { DeleteInventoryDialog } from '@/components/inventory/DeleteInventoryDialog';
import { LowStockDialog } from '@/components/inventory/LowStockDialog';
import { SKUAnalyticsDialog } from '@/components/inventory/SKUAnalyticsDialog';
import { StockMovementAnalyticsDialog } from '@/components/inventory/StockMovementAnalyticsDialog';
import { StockValueAnalyticsDialog } from '@/components/inventory/StockValueAnalyticsDialog';
import { OfficeBreakdownDialog } from '@/components/inventory/OfficeBreakdownDialog';
import { cn } from '@/lib/utils';

export default function Inventory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string | undefined>();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lowStockDialogOpen, setLowStockDialogOpen] = useState(false);
  const [skuDialogOpen, setSkuDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: inventory = [], isLoading } = useInventory(selectedOffice);
  const { data: lowStockItems = [] } = useLowStockItems();

  // Calculate stats
  const totalItems = inventory.length;
  const lowStockCount = lowStockItems.length;
  const totalUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const stockValue = inventory.reduce((sum, item) => {
    const rate = item.product?.default_rate || 0;
    return sum + (item.quantity * rate);
  }, 0);

  const handleAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustDialogOpen(true);
  };

  const handleDelete = (item: InventoryItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('inventory.title', 'Inventory')}</h1>
          <p className="text-muted-foreground">{t('inventory.subtitle', 'Track stock levels across offices')}</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Stock
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
          onClick={() => setSkuDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click for analytics</p>
          </CardContent>
        </Card>
        
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md group",
            lowStockCount > 0 && "border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20 hover:border-yellow-400"
          )}
          onClick={() => setLowStockDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className={cn(
              "h-4 w-4 transition-colors",
              lowStockCount > 0 ? "text-yellow-500" : "text-muted-foreground group-hover:text-yellow-500"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              lowStockCount > 0 && "text-yellow-600 dark:text-yellow-500"
            )}>
              {lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to manage</p>
          </CardContent>
        </Card>
        
        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-green-400 group"
          onClick={() => setMovementDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View movements</p>
          </CardContent>
        </Card>
        
        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-blue-400 group"
          onClick={() => setValueDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ₹{stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View breakdown</p>
          </CardContent>
        </Card>
        
        <Card
          className="cursor-pointer transition-all hover:shadow-md hover:border-purple-400 group"
          onClick={() => setOfficeDialogOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offices</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offices.length}</div>
            <p className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Compare offices</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table - Full Width */}
      <Tabs
        value={selectedOffice || 'all'}
        onValueChange={(v) => setSelectedOffice(v === 'all' ? undefined : v)}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Offices</TabsTrigger>
            {offices.map((office) => (
              <TabsTrigger key={office.id} value={office.id}>
                {office.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value={selectedOffice || 'all'} className="mt-4">
          <InventoryTable
            inventory={inventory}
            isLoading={isLoading}
            onAdjust={handleAdjust}
            onDelete={handleDelete}
            searchQuery={search}
          />
        </TabsContent>
      </Tabs>

      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        item={selectedItem}
      />

      <AddInventoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <DeleteInventoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        item={selectedItem}
      />

      <LowStockDialog
        open={lowStockDialogOpen}
        onOpenChange={setLowStockDialogOpen}
      />

      <SKUAnalyticsDialog
        open={skuDialogOpen}
        onOpenChange={setSkuDialogOpen}
      />

      <StockMovementAnalyticsDialog
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
      />

      <StockValueAnalyticsDialog
        open={valueDialogOpen}
        onOpenChange={setValueDialogOpen}
      />

      <OfficeBreakdownDialog
        open={officeDialogOpen}
        onOpenChange={setOfficeDialogOpen}
        onFilterByOffice={setSelectedOffice}
      />
    </div>
  );
}
