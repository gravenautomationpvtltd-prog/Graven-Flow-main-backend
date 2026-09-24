import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useSalesOrders } from '@/hooks/useSalesOrders';
import { OrderStatsCards } from '@/components/orders/OrderStatsCards';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { FileText } from 'lucide-react';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';
import { useTranslation } from '@/lib/i18n';

export default function Orders() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, isManager, isAdmin } = useAuth();
  const { data: orders, isLoading } = useSalesOrders('all');
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: 'all',
    paymentStatus: 'all',
    salesRep: 'all',
  });

  // Sync URL search param to filters
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) {
      setFilters(prev => ({ ...prev, search: urlSearch }));
    }
  }, [searchParams]);

  // Filter orders based on role, filters, and date range
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    return orders.filter(order => {
      // Role-based filtering: sales users see only their orders
      if (!isManager && !isAdmin && user) {
        if (order.created_by !== user.id) return false;
      }
      
      // Date range filtering
      if (dateRange.from) {
        const orderDate = new Date(order.created_at);
        if (orderDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const orderDate = new Date(order.created_at);
        if (orderDate > dateRange.to) return false;
      }
      
      // Sales rep filter (managers only)
      if (filters.salesRep !== 'all' && order.created_by !== filters.salesRep) {
        return false;
      }
      
      // Status filter
      if (filters.status !== 'all' && order.status !== filters.status) {
        return false;
      }
      
      // Payment status filter
      if (filters.paymentStatus !== 'all' && order.payment_status !== filters.paymentStatus) {
        return false;
      }
      
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesOrderNumber = order.order_number.toLowerCase().includes(searchLower);
        const matchesCustomer = order.customer?.company_name?.toLowerCase().includes(searchLower);
        const matchesContact = order.customer?.contact_person?.toLowerCase().includes(searchLower);
        
        if (!matchesOrderNumber && !matchesCustomer && !matchesContact) {
          return false;
        }
      }
      
      return true;
    });
  }, [orders, filters, user, isManager, isAdmin, dateRange.from, dateRange.to]);

  return (
    <>
      <Helmet>
        <title>{t('orders.title', 'Sales Orders')} | Graven</title>
        <meta name="description" content={t('orders.subtitle_admin', 'Track and manage all sales orders')} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('orders.title', 'Sales Orders')}</h1>
              <p className="text-muted-foreground">
                {isManager || isAdmin 
                  ? t('orders.subtitle_admin', 'Track and manage all sales orders') 
                  : t('orders.subtitle_user', 'View your sales orders and track fulfillment')}
              </p>
            </div>
          </div>
          <DateRangeFilter
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </div>

        {/* Stats Cards */}
        <OrderStatsCards dateRange={dateRange} />

        {/* Filters */}
        <OrderFilters filters={filters} onFiltersChange={setFilters} />

        {/* Orders Table */}
        <OrdersTable orders={filteredOrders} isLoading={isLoading} />
      </div>
    </>
  );
}
