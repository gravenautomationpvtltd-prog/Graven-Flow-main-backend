import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Package, FileText, Truck, CheckCircle, BarChart3, ClipboardList, DollarSign, ArrowRight, Inbox, ShoppingCart, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useGRNs } from '@/hooks/useGRN';
import { useSalesOrders } from '@/hooks/useSalesOrders';
import { usePendingPriceRequestsCount } from '@/hooks/usePriceRequests';
import { PurchaseOrdersTable } from '@/components/procurement/PurchaseOrdersTable';
import { CreatePODialog } from '@/components/procurement/CreatePODialog';
import { SuppliersManagement } from '@/components/procurement/SuppliersManagement';
import { GRNListTable } from '@/components/procurement/GRNListTable';
import { ProcurementAnalytics } from '@/components/procurement/ProcurementAnalytics';
import { SupplierPriceAnalytics } from '@/components/procurement/SupplierPriceAnalytics';
import { PriceGapTrends } from '@/components/procurement/PriceGapTrends';
import { PriceRequestsTab } from '@/components/procurement/PriceRequestsTab';
import { SalesOrdersTable } from '@/components/procurement/SalesOrdersTable';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';

type PrimaryTab = 'requests' | 'orders' | 'suppliers-insights';
type RequestsView = 'price-requests' | 'sales-orders';
type OrdersView = 'purchase-orders' | 'grn';
type SuppliersView = 'suppliers' | 'analytics';

function SegmentedToggle({ 
  options, 
  value, 
  onChange 
}: { 
  options: { value: string; label: string; count?: number; countColor?: string }[]; 
  value: string; 
  onChange: (v: any) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
          {opt.count !== undefined && opt.count > 0 && (
            <span className={cn("ml-1.5 text-xs font-semibold", opt.countColor || "text-muted-foreground")}>
              ({opt.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Procurement() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [grnStatusFilter, setGrnStatusFilter] = useState('all');
  const [salesOrderSearch, setSalesOrderSearch] = useState('');
  const [salesOrderStatusFilter, setSalesOrderStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState<string | undefined>();
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<PrimaryTab>('requests');
  const [requestsView, setRequestsView] = useState<RequestsView>('price-requests');
  const [ordersView, setOrdersView] = useState<OrdersView>('purchase-orders');
  const [suppliersView, setSuppliersView] = useState<SuppliersView>('suppliers');
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);

  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: grns = [] } = useGRNs();
  const { data: pendingOrders = [] } = useSalesOrders('ready_for_procurement');
  const { data: allOrders = [] } = useSalesOrders('all');
  const { data: pendingPriceRequests = 0 } = usePendingPriceRequestsCount();

  // Filter POs by date range
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      if (dateRange.from) {
        const poDate = new Date(po.created_at);
        if (poDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const poDate = new Date(po.created_at);
        if (poDate > dateRange.to) return false;
      }
      return true;
    });
  }, [purchaseOrders, dateRange.from, dateRange.to]);

  // Check URL params for createPO flag
  useEffect(() => {
    if (searchParams.get('createPO') === 'true') {
      const orderId = searchParams.get('salesOrderId');
      if (orderId) {
        setSalesOrderId(orderId);
      }
      setCreateDialogOpen(true);
    }
  }, [searchParams]);

  // Stats
  const pendingStatuses = ['draft', 'sent', 'acknowledged', 'pending_verification', 'pending_authorization', 'pending_approval'];
  const pendingPOs = filteredPOs.filter(po => pendingStatuses.includes(po.status));
  const inTransitPOs = filteredPOs.filter(po => po.status === 'partial');
  const deliveredPOs = filteredPOs.filter(po => po.status === 'delivered');
  
  const handleCardClick = (filterType: string) => {
    setActiveTab('orders');
    setOrdersView('purchase-orders');
    setActiveCardFilter(filterType);
    
    if (filterType === 'all') setStatusFilter('all');
    else if (filterType === 'pending') setStatusFilter('pending_group');
    else if (filterType === 'in_transit') setStatusFilter('partial');
    else if (filterType === 'delivered') setStatusFilter('delivered');
  };

  const stats = {
    total: filteredPOs.length,
    totalValue: filteredPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0),
    pending: pendingPOs.length,
    pendingValue: pendingPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0),
    inTransit: inTransitPOs.length,
    inTransitValue: inTransitPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0),
    delivered: deliveredPOs.length,
    deliveredValue: deliveredPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0),
    pendingGrns: grns.filter(grn => grn.status === 'pending').length,
    pendingOrders: pendingOrders.length,
  };

  // Context-aware stat cards
  const renderStatCards = () => {
    if (activeTab === 'requests') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Price Requests"
            value={pendingPriceRequests}
            subtitle="pending"
            icon={<DollarSign className="h-4 w-4 text-amber-500" />}
            accentColor="amber"
          />
          <StatCard
            title="Sales Orders"
            value={allOrders.length}
            subtitle="total"
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
          />
          <StatCard
            title="Ready for Procurement"
            value={stats.pendingOrders}
            subtitle="awaiting PO"
            icon={<Inbox className="h-4 w-4 text-blue-500" />}
            accentColor="blue"
          />
          <StatCard
            title="Total PO Value"
            value={`₹${stats.totalValue.toLocaleString('en-IN')}`}
            subtitle={`${stats.total} orders`}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            isMonetary
          />
        </div>
      );
    }

    if (activeTab === 'orders') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Total POs"
            value={stats.total}
            subtitle={`₹${stats.totalValue.toLocaleString('en-IN')}`}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            onClick={() => handleCardClick('all')}
            active={activeCardFilter === 'all'}
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            subtitle={`₹${stats.pendingValue.toLocaleString('en-IN')}`}
            icon={<Package className="h-4 w-4 text-amber-500" />}
            accentColor="amber"
            onClick={() => handleCardClick('pending')}
            active={activeCardFilter === 'pending'}
          />
          <StatCard
            title="In Transit"
            value={stats.inTransit}
            subtitle={`₹${stats.inTransitValue.toLocaleString('en-IN')}`}
            icon={<Truck className="h-4 w-4 text-blue-500" />}
            accentColor="blue"
            onClick={() => handleCardClick('in_transit')}
            active={activeCardFilter === 'in_transit'}
          />
          <StatCard
            title="Delivered"
            value={stats.delivered}
            subtitle={`₹${stats.deliveredValue.toLocaleString('en-IN')}`}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            accentColor="green"
            onClick={() => handleCardClick('delivered')}
            active={activeCardFilter === 'delivered'}
          />
        </div>
      );
    }

    // Suppliers & Insights - no stat cards, cleaner
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('procurement.title', 'Procurement')}</h1>
          <p className="text-muted-foreground text-sm">{t('procurement.subtitle', 'Manage requests, orders, and suppliers')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Create PO
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      {renderStatCards()}

      {/* Primary Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val as PrimaryTab); setActiveCardFilter(null); }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            <Inbox className="h-4 w-4" />
            Requests
            {pendingPriceRequests > 0 && (
              <span className="ml-1 rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {pendingPriceRequests}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Orders
            {stats.pendingGrns > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/15 text-amber-600 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {stats.pendingGrns} GRN
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="suppliers-insights" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Suppliers & Insights
          </TabsTrigger>
        </TabsList>

        {/* === REQUESTS TAB === */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SegmentedToggle
              value={requestsView}
              onChange={setRequestsView}
              options={[
                { value: 'price-requests', label: 'Price Requests', count: pendingPriceRequests, countColor: 'text-destructive' },
                { value: 'sales-orders', label: 'Sales Orders', count: allOrders.length },
              ]}
            />
            {requestsView === 'sales-orders' && (
              <div className="flex items-center gap-3">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search orders..."
                    value={salesOrderSearch}
                    onChange={(e) => setSalesOrderSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={salesOrderStatusFilter} onValueChange={setSalesOrderStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending_documents">Pending Documents</SelectItem>
                    <SelectItem value="ready_for_procurement">Ready for Procurement</SelectItem>
                    <SelectItem value="in_procurement">In Procurement</SelectItem>
                    <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
                    <SelectItem value="ready_to_dispatch">Ready to Dispatch</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {requestsView === 'price-requests' ? (
            <PriceRequestsTab />
          ) : (
            <SalesOrdersTable searchQuery={salesOrderSearch} statusFilter={salesOrderStatusFilter} />
          )}
        </TabsContent>

        {/* === ORDERS TAB === */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <SegmentedToggle
              value={ordersView}
              onChange={setOrdersView}
              options={[
                { value: 'purchase-orders', label: 'Purchase Orders', count: stats.total },
                { value: 'grn', label: 'GRN', count: stats.pendingGrns, countColor: 'text-amber-600' },
              ]}
            />
            {ordersView === 'purchase-orders' ? (
              <div className="flex items-center gap-3">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search POs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search GRNs..."
                    value={grnSearch}
                    onChange={(e) => setGrnSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={grnStatusFilter} onValueChange={setGrnStatusFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {ordersView === 'purchase-orders' ? (
            <PurchaseOrdersTable searchQuery={search} statusFilter={statusFilter} />
          ) : (
            <GRNListTable searchQuery={grnSearch} statusFilter={grnStatusFilter} />
          )}
        </TabsContent>

        {/* === SUPPLIERS & INSIGHTS TAB === */}
        <TabsContent value="suppliers-insights" className="space-y-4">
          <SegmentedToggle
            value={suppliersView}
            onChange={setSuppliersView}
            options={[
              { value: 'suppliers', label: 'Suppliers' },
              { value: 'analytics', label: 'Analytics' },
            ]}
          />
          
          {suppliersView === 'suppliers' ? (
            <SuppliersManagement />
          ) : (
            <div className="space-y-4">
              <ProcurementAnalytics />
              <SupplierPriceAnalytics />
              <PriceGapTrends />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreatePODialog 
        open={createDialogOpen} 
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setSalesOrderId(undefined);
        }}
        salesOrderId={salesOrderId}
      />
    </div>
  );
}

// Reusable stat card component
function StatCard({ 
  title, value, subtitle, icon, accentColor, onClick, active, isMonetary 
}: { 
  title: string; 
  value: number | string; 
  subtitle: string; 
  icon: React.ReactNode; 
  accentColor?: string;
  onClick?: () => void;
  active?: boolean;
  isMonetary?: boolean;
}) {
  const colorMap: Record<string, string> = {
    amber: 'ring-amber-500 bg-amber-500/5 hover:bg-amber-500/10',
    blue: 'ring-blue-500 bg-blue-500/5 hover:bg-blue-500/10',
    green: 'ring-green-500 bg-green-500/5 hover:bg-green-500/10',
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.01]",
        active && accentColor && `ring-2 ${colorMap[accentColor]}`,
        active && !accentColor && "ring-2 ring-primary bg-primary/5",
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={cn("font-bold", isMonetary ? "text-lg" : "text-2xl")}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
