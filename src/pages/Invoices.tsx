import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceStatsCards } from '@/components/invoices/InvoiceStatsCards';
import { InvoicesTable } from '@/components/invoices/InvoicesTable';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';

export default function Invoices() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  
  // Date range state: if user is searching for a specific invoice, default datePreset to 'all'
  const [datePreset, setDatePreset] = useState<DatePreset>(initialSearch ? 'all' : 'this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);

  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setSearchQuery(s);
      setDatePreset('all');
    }
  }, [searchParams]);

  const { data: invoices = [], isLoading } = useInvoices(activeTab === 'all' ? undefined : activeTab);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesInvoiceNo = inv.invoice_number?.toLowerCase().includes(query);
        const matchesCompany = inv.customer?.company_name?.toLowerCase().includes(query);
        const matchesContact = inv.customer?.contact_person?.toLowerCase().includes(query);
        const matchesPhone = inv.customer?.phone?.toLowerCase().includes(query);
        const matchesEmail = inv.customer?.email?.toLowerCase().includes(query);
        if (!matchesInvoiceNo && !matchesCompany && !matchesContact && !matchesPhone && !matchesEmail) {
          return false;
        }
      }
      
      // Date range filter
      if (dateRange.from) {
        const invoiceDate = new Date(inv.invoice_date);
        if (invoiceDate < dateRange.from) return false;
      }
      if (dateRange.to) {
        const invoiceDate = new Date(inv.invoice_date);
        if (invoiceDate > dateRange.to) return false;
      }
      
      return true;
    });
  }, [invoices, searchQuery, dateRange.from, dateRange.to]);

  return (
    <>
      <Helmet>
        <title>Invoices | Graven</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">{t('invoices.title', 'Invoices')}</h1>
            <p className="text-muted-foreground">{t('invoices.subtitle', 'Manage your sales invoices and track payments')}</p>
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

        <InvoiceStatsCards dateRange={dateRange} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="partial">Partial</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[250px]"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            <InvoicesTable invoices={filteredInvoices} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
