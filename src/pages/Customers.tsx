import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Download, Loader2, Target, MessageCircle, Mail, X, Sparkles } from 'lucide-react';
import { useCustomers, fetchAllCustomers } from '@/hooks/useCustomers';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerListTable } from '@/components/customers/CustomerListTable';
import { CreateCustomerDialog } from '@/components/customers/CreateCustomerDialog';
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog';
import { DeleteCustomerDialog } from '@/components/customers/DeleteCustomerDialog';
import { ImportCustomersDialog } from '@/components/customers/ImportCustomersDialog';
import { BulkOutreachDialog } from '@/components/customers/BulkOutreachDialog';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { exportCustomersToCSV, exportCustomersForGoogleAds, downloadCSV } from '@/lib/csv-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';
import { useCustomerOutreachDates } from '@/hooks/useCustomerOutreachDates';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useTrackOutreach } from '@/hooks/useTrackOutreach';
import { useEnquiryTemplate } from '@/hooks/useCustomerOutreach';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];

export default function Customers() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    customerType: 'all',
    assignedTo: 'all',
    outreachStatus: 'all',
    segment: 'all',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [retargetDialogOpen, setRetargetDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  
  const datePreset: DatePreset = 'all_time';
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [datePresetState, setDatePresetState] = useState<DatePreset>(datePreset);
  const dateRange = getDateRangeFromPreset(datePresetState, customFrom, customTo);

  const trackOutreach = useTrackOutreach();
  const { data: whatsappTemplate } = useEnquiryTemplate('whatsapp');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) {
      setFilters(prev => ({ ...prev, search: urlSearch }));
    }
  }, [searchParams]);

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(0);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  };

  const { user, isManager, isAdmin } = useAuth();
  // Non-manager sales reps are scoped to their own customers; managers/admins see the broader set
  // (RLS still enforces the final visibility on the server).
  const scopedAssignedSalesId =
    !isManager && !isAdmin && user?.id
      ? user.id
      : filters.assignedTo !== 'all'
        ? filters.assignedTo
        : undefined;

  const { data: customersResult, isLoading } = useCustomers({
    search: filters.search || undefined,
    page: currentPage,
    pageSize: pageSize,
    segment: filters.segment,
    assignedSalesId: scopedAssignedSalesId,
  });

  // Fetch outreach dates for filtering
  const allCustomerIds = useMemo(() => (customersResult?.data || []).map(c => c.id), [customersResult?.data]);
  const { data: outreachDates } = useCustomerOutreachDates(allCustomerIds);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customersResult?.data?.filter((customer) => {
      if (filters.customerType === 'b2b' && !customer.is_b2b) return false;
      if (filters.customerType === 'b2c' && customer.is_b2b) return false;
      if (filters.assignedTo !== 'all' && customer.assigned_sales_id !== filters.assignedTo) return false;
      
      // Date range filter
      if (dateRange.from) {
        const customerDate = new Date(customer.created_at);
        if (customerDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const customerDate = new Date(customer.created_at);
        if (customerDate > dateRange.to) return false;
      }

      // Outreach status filter
      if (filters.outreachStatus !== 'all' && outreachDates) {
        const lastDate = outreachDates.get(customer.id);
        if (filters.outreachStatus === 'never') {
          if (lastDate) return false;
        } else {
          const daysThreshold = parseInt(filters.outreachStatus);
          if (lastDate) {
            const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince < daysThreshold) return false;
          }
          // If never contacted, include them (they haven't been contacted in X days)
        }
      }

      
      return true;
    });
  }, [customersResult?.data, filters, dateRange.from, dateRange.to, outreachDates]);

  // Bulk selection
  const getItemId = useCallback((customer: Customer) => customer.id, []);
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    toggleSelection,
    deselectAll,
    toggleSelectAll,
    isAllSelected,
    isSomeSelected,
  } = useBulkSelection({ items: filteredCustomers || [], getItemId });

  const handleBulkWhatsApp = async () => {
    const customersWithPhone = selectedItems.filter(c => c.phone);
    if (!customersWithPhone.length) {
      toast.error('No selected customers have phone numbers');
      return;
    }

    for (const customer of customersWithPhone.slice(0, 10)) {
      try {
        await trackOutreach.mutateAsync({ customerId: customer.id, channel: 'whatsapp' });
      } catch {}
      const phone = customer.phone.replace(/\D/g, '');
      const phoneWithCountry = phone.startsWith('91') ? phone : `91${phone.slice(-10)}`;
      let message = 'Hello! We wanted to check if you have any enquiries for automation products.';
      if (whatsappTemplate?.body) {
        const customerName = customer.contact_person || customer.company_name;
        message = whatsappTemplate.body.replace(/\{\{customer_name\}\}/g, customerName);
      }
      window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
    }
    if (customersWithPhone.length > 10) {
      toast.info(`Opened first 10 WhatsApp chats. ${customersWithPhone.length - 10} remaining.`);
    }
    deselectAll();
  };

  const handleBulkEmail = async () => {
    const customersWithEmail = selectedItems.filter(c => c.email);
    if (!customersWithEmail.length) {
      toast.error('No selected customers have email addresses');
      return;
    }
    toast.info(`Sending email outreach to ${customersWithEmail.length} customers...`);
    // Trigger edge function for selected customer IDs
    const { supabase } = await import('@/integrations/supabase/client');
    try {
      const { data, error } = await supabase.functions.invoke('customer-outreach', {
        body: {
          customerIds: customersWithEmail.map(c => c.id),
          channels: ['email'],
        },
      });
      if (error) throw error;
      toast.success(`Email sent to ${data?.stats?.emailsSent || customersWithEmail.length} customers`);
    } catch (error: any) {
      toast.error('Failed to send bulk emails: ' + error.message);
    }
    deselectAll();
  };

  const handleExportAll = async (format: 'standard' | 'google-ads' = 'standard') => {
    setIsExporting(true);
    try {
      toast.info('Fetching all customers for export...');
      const allCustomers = await fetchAllCustomers(filters.search || undefined);
      
      const filteredForExport = allCustomers.filter((customer) => {
        if (filters.customerType === 'b2b' && !customer.is_b2b) return false;
        if (filters.customerType === 'b2c' && customer.is_b2b) return false;
        if (filters.assignedTo !== 'all' && customer.assigned_sales_id !== filters.assignedTo) return false;
        return true;
      });

      if (!filteredForExport.length) {
        toast.error('No customers to export');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      if (format === 'google-ads') {
        const csv = exportCustomersForGoogleAds(filteredForExport);
        const rowCount = Math.max(csv.split('\n').length - 1, 0);
        if (!rowCount) {
          toast.error('No contactable customers to export');
          return;
        }
        downloadCSV(csv, `google-ads-customer-match_${today}.csv`);
        toast.success(`Exported ${rowCount.toLocaleString()} customers for Google Ads`);
      } else {
        const csv = exportCustomersToCSV(filteredForExport);
        downloadCSV(csv, `customers_${today}.csv`);
        toast.success(`Exported ${filteredForExport.length.toLocaleString()} customers successfully`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export customers');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAutoSegment = async () => {
    setIsSegmenting(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-segment-customers');
      if (error) throw error;
      toast.success(`Segmentation complete — ${data?.customers_updated || 0} customers updated`);
    } catch (error) {
      console.error('Auto-segment error:', error);
      toast.error('Failed to run auto-segmentation');
    } finally {
      setIsSegmenting(false);
    }
  };

  const bulkActions = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="h-4 w-4" />,
      onClick: handleBulkWhatsApp,
    },
    {
      id: 'email',
      label: 'Email',
      icon: <Mail className="h-4 w-4" />,
      onClick: handleBulkEmail,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('customers.title', 'Customers')}</h1>
          <p className="text-muted-foreground">{t('customers.subtitle', 'Manage your customer database')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            datePreset={datePresetState}
            onDatePresetChange={setDatePresetState}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            showAllTime={true}
          />
          <Button
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
            onClick={() => setRetargetDialogOpen(true)}
          >
            <Target className="mr-2 h-4 w-4" />
            {t('customers.retarget', 'Retarget')}
          </Button>
          <Button variant="outline" onClick={handleAutoSegment} disabled={isSegmenting}>
            {isSegmenting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isSegmenting ? 'Segmenting...' : 'Auto-Segment'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isExporting ? t('customers.exporting', 'Exporting...') : t('customers.export_all', 'Export All')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportAll('standard')}>
                Standard CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportAll('google-ads')}>
                Google Ads (Customer Match)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('action.import', 'Import')}
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('customers.add_customer', 'Add Customer')}
          </Button>
        </div>
      </div>

      <CustomerFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <CustomerListTable
        customers={filteredCustomers}
        isLoading={isLoading}
        onEdit={setEditCustomer}
        onDelete={setDeleteCustomer}
        totalCount={customersResult?.totalCount ?? 0}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        onToggleSelectAll={toggleSelectAll}
        isAllSelected={isAllSelected}
        isSomeSelected={isSomeSelected}
      />

      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={deselectAll}
        actions={bulkActions}
      />

      <CreateCustomerDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <ImportCustomersDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <BulkOutreachDialog open={retargetDialogOpen} onOpenChange={setRetargetDialogOpen} />
      <EditCustomerDialog customer={editCustomer} open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)} />
      <DeleteCustomerDialog customer={deleteCustomer} open={!!deleteCustomer} onOpenChange={(open) => !open && setDeleteCustomer(null)} />
    </div>
  );
}
