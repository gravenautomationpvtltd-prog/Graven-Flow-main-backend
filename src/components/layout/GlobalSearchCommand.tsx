import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  Users, 
  ShoppingCart, 
  FileText, 
  Truck, 
  Package, 
  Building2, 
  Phone, 
  Search, 
  Loader2,
  UserCheck,
  X,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface SearchResult {
  id: string;
  type: 'lead' | 'customer' | 'order' | 'invoice' | 'dispatch' | 'supplier' | 'product' | 'quotation' | 'employee';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  searchableText?: string;
  leadId?: string | null;
  customerId?: string | null;
}

// PostgREST .or() uses comma + parens as separators. Strip characters that break filter.
export const sanitize = (q: string) => q.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();

interface GlobalSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeQueryIdRef = useRef<number>(0);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'lead':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'customer':
        return <Users className="h-4 w-4 text-green-500" />;
      case 'order':
        return <ShoppingCart className="h-4 w-4 text-purple-500" />;
      case 'invoice':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'quotation':
        return <FileText className="h-4 w-4 text-indigo-500" />;
      case 'dispatch':
        return <Truck className="h-4 w-4 text-cyan-500" />;
      case 'supplier':
        return <Building2 className="h-4 w-4 text-orange-500" />;
      case 'product':
        return <Package className="h-4 w-4 text-pink-500" />;
      case 'employee':
        return <UserCheck className="h-4 w-4 text-emerald-500" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getRoute = (result: SearchResult) => {
    switch (result.type) {
      case 'lead':
        return `/leads/${result.id}`;
      case 'customer':
        return `/customers/${result.id}`;
      case 'order':
        return `/orders/${result.id}`;
      case 'invoice':
        return `/invoices?search=${encodeURIComponent(result.title)}`;
      case 'quotation':
        if (result.leadId) return `/leads/${result.leadId}`;
        if (result.customerId) return `/customers/${result.customerId}`;
        return `/supplier-network/quotations`;
      case 'dispatch':
        return `/dispatch?search=${encodeURIComponent(result.title)}`;
      case 'supplier':
        return `/suppliers/${result.id}`;
      case 'product':
        return `/products/${result.id}`;
      case 'employee':
        return `/employees/${result.id}`;
      default:
        return '/';
    }
  };

  // Safe query executor that catches RLS / permission / network errors per-entity
  // so that if a user's role lacks permissions on invoices or employees,
  // other permitted entities (leads, customers, products) continue to return results smoothly.
  const safeQuery = async <T,>(p: Promise<{ data: T | null; error?: any }>): Promise<T | null> => {
    try {
      const res = await p;
      if (res.error) return null;
      return res.data;
    } catch {
      return null;
    }
  };

  const searchAll = useCallback(async (rawQuery: string) => {
    const query = sanitize(rawQuery);
    if (!query || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentQueryId = ++activeQueryIdRef.current;
    setIsLoading(true);
    setError(null);
    const searchResults: SearchResult[] = [];
    const like = `%${query}%`;

    try {
      // 1. Launch all Tier-1 direct queries + customers query concurrently at T = 0ms
      const customersPromise = safeQuery(
        supabase
          .from('customers')
          .select('id, company_name, contact_person, phone, alternate_phone, email, gst_number, assigned_sales:profiles!assigned_sales_id(full_name)')
          .or(`company_name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},alternate_phone.ilike.${like},email.ilike.${like},gst_number.ilike.${like}`)
          .is('deleted_at', null)
          .limit(15)
      );

      const leadsByTitleAndRefPromise = safeQuery(
        supabase
          .from('leads')
          .select('id, title, status, source_reference, customer_query, customer:customers(id, company_name, contact_person, phone, email)')
          .or(`title.ilike.${like},source_reference.ilike.${like},customer_query.ilike.${like}`)
          .is('deleted_at', null)
          .limit(10)
      );

      const quotationsByNumberAndSubjectPromise = safeQuery(
        supabase
          .from('quotations')
          .select('id, quotation_number, status, grand_total, subject, notes, customer_id, lead_id, customer:customers(company_name, contact_person)')
          .or(`quotation_number.ilike.${like},subject.ilike.${like},notes.ilike.${like}`)
          .is('deleted_at', null)
          .limit(8)
      );

      const ordersByNumberPromise = safeQuery(
        supabase
          .from('sales_orders')
          .select('id, order_number, status, order_value, notes, customer:customers(company_name, contact_person)')
          .or(`order_number.ilike.${like},notes.ilike.${like}`)
          .limit(8)
      );

      const invoicesByNumberPromise = safeQuery(
        supabase
          .from('invoices')
          .select('id, invoice_number, status, grand_total, customer:customers(company_name, contact_person)')
          .ilike('invoice_number', like)
          .limit(8)
      );

      const dispatchesByNumberAndTrackingPromise = safeQuery(
        supabase
          .from('dispatches')
          .select('id, dispatch_number, status, tracking_number, courier_name, eway_bill_number, customer:customers(company_name, contact_person)')
          .or(`dispatch_number.ilike.${like},tracking_number.ilike.${like},courier_name.ilike.${like},eway_bill_number.ilike.${like}`)
          .limit(8)
      );

      const suppliersPromise = safeQuery(
        supabase
          .from('suppliers')
          .select('id, name, contact_person, phone, email, gst_number')
          .or(`name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},email.ilike.${like},gst_number.ilike.${like}`)
          .limit(10)
      );

      // Fast, targeted product search — indexing identifiers (name, brand, model_number, category, hsn_code)
      // omitting heavy unindexed description/search_key text scans to eliminate 2-second bottleneck
      const productsPromise = safeQuery(
        supabase
          .from('products')
          .select('id, name, category, brand, model_number, hsn_code')
          .or(`name.ilike.${like},category.ilike.${like},brand.ilike.${like},model_number.ilike.${like},hsn_code.ilike.${like}`)
          .limit(10)
      );

      const employeesPromise = safeQuery(
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, employment_status, is_active')
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(10)
      );

      // As soon as customers query returns, execute bridged queries (if any customer matched)
      const customerBridgedPromises = customersPromise.then(async (customersData) => {
        const matchedCustomerIds = (customersData || []).map((c: any) => c.id).slice(0, 30);
        if (!matchedCustomerIds.length) {
          return {
            customersData,
            leadsByCustomer: [] as any[],
            quotationsByCustomer: [] as any[],
            ordersByCustomer: [] as any[],
            invoicesByCustomer: [] as any[],
            dispatchesByCustomer: [] as any[],
          };
        }
        const [leadsByCustomer, quotationsByCustomer, ordersByCustomer, invoicesByCustomer, dispatchesByCustomer] =
          await Promise.all([
            safeQuery(
              supabase
                .from('leads')
                .select('id, title, status, source_reference, customer_query, customer:customers(id, company_name, contact_person, phone, email)')
                .in('customer_id', matchedCustomerIds)
                .is('deleted_at', null)
                .limit(10)
            ),
            safeQuery(
              supabase
                .from('quotations')
                .select('id, quotation_number, status, grand_total, subject, notes, customer_id, lead_id, customer:customers(company_name, contact_person)')
                .in('customer_id', matchedCustomerIds)
                .is('deleted_at', null)
                .limit(8)
            ),
            safeQuery(
              supabase
                .from('sales_orders')
                .select('id, order_number, status, order_value, notes, customer:customers(company_name, contact_person)')
                .in('customer_id', matchedCustomerIds)
                .limit(8)
            ),
            safeQuery(
              supabase
                .from('invoices')
                .select('id, invoice_number, status, grand_total, customer:customers(company_name, contact_person)')
                .in('customer_id', matchedCustomerIds)
                .limit(8)
            ),
            safeQuery(
              supabase
                .from('dispatches')
                .select('id, dispatch_number, status, tracking_number, courier_name, eway_bill_number, customer:customers(company_name, contact_person)')
                .in('customer_id', matchedCustomerIds)
                .limit(8)
            ),
          ]);

        return {
          customersData,
          leadsByCustomer: leadsByCustomer || [],
          quotationsByCustomer: quotationsByCustomer || [],
          ordersByCustomer: ordersByCustomer || [],
          invoicesByCustomer: invoicesByCustomer || [],
          dispatchesByCustomer: dispatchesByCustomer || [],
        };
      });

      // Await all concurrently
      const [
        bridged,
        leadsByTitleAndRef,
        quotationsByNumberAndSubject,
        ordersByNumber,
        invoicesByNumber,
        dispatchesByNumberAndTracking,
        suppliersData,
        productsData,
        employeesData,
      ] = await Promise.all([
        customerBridgedPromises,
        leadsByTitleAndRefPromise,
        quotationsByNumberAndSubjectPromise,
        ordersByNumberPromise,
        invoicesByNumberPromise,
        dispatchesByNumberAndTrackingPromise,
        suppliersPromise,
        productsPromise,
        employeesPromise,
      ]);

      // Check if a newer search was initiated while queries were running
      if (currentQueryId !== activeQueryIdRef.current) return;

      const {
        customersData,
        leadsByCustomer,
        quotationsByCustomer,
        ordersByCustomer,
        invoicesByCustomer,
        dispatchesByCustomer,
      } = bridged;

      // Process & dedupe leads
      const leadMap = new Map<string, any>();
      [...(leadsByTitleAndRef || []), ...(leadsByCustomer || [])].forEach((l) => {
        if (!leadMap.has(l.id)) leadMap.set(l.id, l);
      });
      leadMap.forEach((lead) => {
        const customer = lead.customer as { company_name?: string; contact_person?: string; phone?: string; email?: string } | null;
        const subParts = [customer?.company_name || customer?.contact_person, lead.source_reference ? `Ref: ${lead.source_reference}` : null].filter(Boolean);
        searchResults.push({
          id: lead.id,
          type: 'lead',
          title: lead.title || 'Untitled Lead',
          subtitle: subParts.join(' • ') || undefined,
          badge: lead.status,
          badgeVariant: lead.status === 'won' ? 'default' : lead.status === 'lost' ? 'destructive' : 'secondary',
          searchableText: [customer?.phone, customer?.email, customer?.company_name, customer?.contact_person, lead.source_reference, lead.customer_query].filter(Boolean).join(' '),
        });
      });

      // Process & dedupe customers
      if (customersData) {
        customersData.forEach((customer: any) => {
          const salesPerson = customer.assigned_sales?.full_name;
          const subtitleParts = [
            customer.contact_person || customer.phone,
            customer.gst_number ? `GST: ${customer.gst_number}` : null,
            salesPerson ? `Sales: ${salesPerson}` : null
          ].filter(Boolean);
          searchResults.push({
            id: customer.id,
            type: 'customer',
            title: customer.company_name,
            subtitle: subtitleParts.join(' • ') || undefined,
            searchableText: [customer.phone, customer.alternate_phone, customer.email, customer.contact_person, customer.gst_number, salesPerson].filter(Boolean).join(' '),
          });
        });
      }

      // Process & dedupe employees
      if (employeesData) {
        employeesData.forEach((employee: any) => {
          const parts = [
            employee.email,
            employee.phone,
            employee.employment_status ? employee.employment_status.replace(/_/g, ' ') : null,
          ].filter(Boolean);
          searchResults.push({
            id: employee.id,
            type: 'employee',
            title: employee.full_name || 'Employee',
            subtitle: parts.join(' • ') || undefined,
            badge: employee.is_active ? 'Active' : 'Inactive',
            badgeVariant: employee.is_active ? 'default' : 'secondary',
            searchableText: [employee.full_name, employee.email, employee.phone, employee.employment_status].filter(Boolean).join(' '),
          });
        });
      }

      // Process & dedupe quotations
      const quoteMap = new Map<string, any>();
      [...(quotationsByNumberAndSubject || []), ...(quotationsByCustomer || [])].forEach((q) => {
        if (!quoteMap.has(q.id)) quoteMap.set(q.id, q);
      });
      quoteMap.forEach((q) => {
        const c = q.customer as { company_name?: string; contact_person?: string } | null;
        const parts = [
          c?.company_name || c?.contact_person,
          q.subject,
          q.grand_total != null ? `₹${Number(q.grand_total).toLocaleString('en-IN')}` : null,
        ].filter(Boolean);
        searchResults.push({
          id: q.id,
          type: 'quotation',
          title: q.quotation_number,
          subtitle: parts.join(' • ') || undefined,
          badge: q.status,
          badgeVariant: q.status === 'accepted' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary',
          leadId: q.lead_id,
          customerId: q.customer_id,
        });
      });

      // Process & dedupe orders
      const orderMap = new Map<string, any>();
      [...(ordersByNumber || []), ...(ordersByCustomer || [])].forEach((o) => {
        if (!orderMap.has(o.id)) orderMap.set(o.id, o);
      });
      orderMap.forEach((order) => {
        const c = order.customer as { company_name?: string; contact_person?: string } | null;
        const parts = [
          c?.company_name || c?.contact_person,
          `₹${(order.order_value || 0).toLocaleString('en-IN')}`,
        ].filter(Boolean);
        searchResults.push({
          id: order.id,
          type: 'order',
          title: order.order_number,
          subtitle: parts.join(' • ') || undefined,
          badge: order.status,
          badgeVariant: order.status === 'fulfilled' ? 'default' : 'secondary',
        });
      });

      // Process & dedupe invoices
      const invoiceMap = new Map<string, any>();
      [...(invoicesByNumber || []), ...(invoicesByCustomer || [])].forEach((inv) => {
        if (!invoiceMap.has(inv.id)) invoiceMap.set(inv.id, inv);
      });
      invoiceMap.forEach((invoice) => {
        const c = invoice.customer as { company_name?: string; contact_person?: string } | null;
        const parts = [
          c?.company_name || c?.contact_person,
          `₹${(invoice.grand_total || 0).toLocaleString('en-IN')}`,
        ].filter(Boolean);
        searchResults.push({
          id: invoice.id,
          type: 'invoice',
          title: invoice.invoice_number,
          subtitle: parts.join(' • ') || undefined,
          badge: invoice.status,
          badgeVariant: invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary',
        });
      });

      // Process & dedupe dispatches
      const dispatchMap = new Map<string, any>();
      [...(dispatchesByNumberAndTracking || []), ...(dispatchesByCustomer || [])].forEach((d) => {
        if (!dispatchMap.has(d.id)) dispatchMap.set(d.id, d);
      });
      dispatchMap.forEach((dispatch) => {
        const c = dispatch.customer as { company_name?: string; contact_person?: string } | null;
        const parts = [
          c?.company_name || c?.contact_person,
          dispatch.courier_name,
          dispatch.tracking_number ? `Track: ${dispatch.tracking_number}` : null,
        ].filter(Boolean);
        searchResults.push({
          id: dispatch.id,
          type: 'dispatch',
          title: dispatch.dispatch_number,
          subtitle: parts.join(' • ') || undefined,
          badge: dispatch.status,
          badgeVariant: dispatch.status === 'delivered' ? 'default' : 'secondary',
        });
      });

      // Process suppliers
      if (suppliersData) {
        suppliersData.forEach((supplier: any) => {
          const parts = [
            supplier.contact_person || supplier.phone,
            supplier.gst_number ? `GST: ${supplier.gst_number}` : null,
          ].filter(Boolean);
          searchResults.push({
            id: supplier.id,
            type: 'supplier',
            title: supplier.name,
            subtitle: parts.join(' • ') || undefined,
            searchableText: [supplier.phone, supplier.email, supplier.contact_person, supplier.gst_number].filter(Boolean).join(' '),
          });
        });
      }

      // Process products
      if (productsData) {
        productsData.forEach((product: any) => {
          const parts = [
            product.brand,
            product.category,
            product.model_number ? `Model: ${product.model_number}` : null,
            product.hsn_code ? `HSN: ${product.hsn_code}` : null,
          ].filter(Boolean);
          searchResults.push({
            id: product.id,
            type: 'product',
            title: product.name,
            subtitle: parts.join(' • ') || undefined,
          });
        });
      }

      setResults(searchResults);
    } catch (err: any) {
      if (currentQueryId === activeQueryIdRef.current) {
        console.error('Search error:', err);
        setError(err?.message || 'Search encountered a problem. Please try again.');
      }
    } finally {
      if (currentQueryId === activeQueryIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced search with cleanup
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (search.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        searchAll(search);
      }, 300);
    } else {
      setResults([]);
      setIsLoading(false);
      setError(null);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, searchAll]);

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearch('');
    setResults([]);
    setError(null);
    setIsLoading(false);
  };

  const handleSelect = (result: SearchResult) => {
    navigate(getRoute(result));
    onOpenChange(false);
    handleClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const q = sanitize(search);
      if (q.length >= 2) {
        if (results.length > 0 && !isLoading) {
          e.preventDefault();
          handleSelect(results[0]);
        } else {
          searchAll(search);
        }
      }
    }
  };

  // Group results by type in consistent order (employees included)
  const typeOrder: SearchResult['type'][] = [
    'lead',
    'customer',
    'employee',
    'quotation',
    'order',
    'invoice',
    'dispatch',
    'supplier',
    'product'
  ];

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeLabels: Record<string, string> = {
    lead: 'Leads',
    customer: 'Customers',
    employee: 'Employees',
    order: 'Orders',
    quotation: 'Quotations',
    invoice: 'Invoices',
    dispatch: 'Dispatches',
    supplier: 'Suppliers',
    product: 'Products',
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <div className="relative">
        <CommandInput
          placeholder="Search leads, customers, employees, orders, quotations, products..."
          value={search}
          onValueChange={(val) => {
            setSearch(val);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted transition-colors"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandList>
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Searching across OneDesk...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <span className="text-sm text-destructive font-medium">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchAll(search)}
              className="mt-2 gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Search
            </Button>
          </div>
        )}
        
        {!isLoading && !error && search.trim().length >= 2 && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No results found for &ldquo;<span className="font-medium text-foreground">{search}</span>&rdquo;
          </div>
        )}

        {!isLoading && !error && search.trim().length < 2 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search across leads, customers, employees, quotations, orders, and products...
          </div>
        )}

        {!isLoading && !error && typeOrder.filter(t => groupedResults[t]?.length).map((type, index) => {
          const items = groupedResults[type];
          return (
            <div key={type}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={typeLabels[type] || type}>
                {items.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 py-3 cursor-pointer"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{result.title}</span>
                        {result.badge && (
                          <Badge variant={result.badgeVariant || 'secondary'} className="text-xs shrink-0">
                            {result.badge}
                          </Badge>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">{result.type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
