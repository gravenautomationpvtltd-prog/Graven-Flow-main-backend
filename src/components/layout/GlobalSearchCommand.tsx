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
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  type: 'lead' | 'customer' | 'order' | 'invoice' | 'dispatch' | 'supplier' | 'product' | 'quotation';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  searchableText?: string;
  leadId?: string | null;
  customerId?: string | null;
}

// PostgREST .or() uses comma + parens as separators. Strip characters that break filter.
const sanitize = (q: string) => q.replace(/[%,()*\\]/g, '').trim();

interface GlobalSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      default:
        return '/';
    }
  };

  const searchAll = useCallback(async (rawQuery: string) => {
    const query = sanitize(rawQuery);
    if (!query || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResult[] = [];
    const like = `%${query}%`;

    try {
      // 1. Find matching customers first — their IDs bridge to leads, quotes, orders, invoices, and dispatches
      const customersResult = await supabase
        .from('customers')
        .select('id, company_name, contact_person, phone, email, gst_number, assigned_sales:profiles!assigned_sales_id(full_name)')
        .or(`company_name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},email.ilike.${like},gst_number.ilike.${like}`)
        .is('deleted_at', null)
        .limit(15);

      const matchedCustomerIds = (customersResult.data || []).map((c: any) => c.id);

      // 2. Parallel queries across all entities
      const [
        leadsByTitleAndRef,
        leadsByCustomer,
        quotationsByNumberAndSubject,
        quotationsByCustomer,
        ordersByNumber,
        ordersByCustomer,
        invoicesByNumber,
        invoicesByCustomer,
        dispatchesByNumberAndTracking,
        dispatchesByCustomer,
        suppliersResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('id, title, status, source_reference, customer:customers(id, company_name, contact_person, phone, email)')
          .or(`title.ilike.${like},source_reference.ilike.${like}`)
          .is('deleted_at', null)
          .limit(10),

        matchedCustomerIds.length
          ? supabase
              .from('leads')
              .select('id, title, status, source_reference, customer:customers(id, company_name, contact_person, phone, email)')
              .in('customer_id', matchedCustomerIds)
              .is('deleted_at', null)
              .limit(10)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('quotations')
          .select('id, quotation_number, status, grand_total, subject, customer_id, lead_id, customer:customers(company_name, contact_person)')
          .or(`quotation_number.ilike.${like},subject.ilike.${like}`)
          .is('deleted_at', null)
          .limit(8),

        matchedCustomerIds.length
          ? supabase
              .from('quotations')
              .select('id, quotation_number, status, grand_total, subject, customer_id, lead_id, customer:customers(company_name, contact_person)')
              .in('customer_id', matchedCustomerIds)
              .is('deleted_at', null)
              .limit(8)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('sales_orders')
          .select('id, order_number, status, order_value, customer:customers(company_name, contact_person)')
          .ilike('order_number', like)
          .limit(8),

        matchedCustomerIds.length
          ? supabase
              .from('sales_orders')
              .select('id, order_number, status, order_value, customer:customers(company_name, contact_person)')
              .in('customer_id', matchedCustomerIds)
              .limit(8)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('invoices')
          .select('id, invoice_number, status, grand_total, customer:customers(company_name, contact_person)')
          .ilike('invoice_number', like)
          .limit(8),

        matchedCustomerIds.length
          ? supabase
              .from('invoices')
              .select('id, invoice_number, status, grand_total, customer:customers(company_name, contact_person)')
              .in('customer_id', matchedCustomerIds)
              .limit(8)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('dispatches')
          .select('id, dispatch_number, status, tracking_number, courier_name, eway_bill_number, customer:customers(company_name, contact_person)')
          .or(`dispatch_number.ilike.${like},tracking_number.ilike.${like},courier_name.ilike.${like},eway_bill_number.ilike.${like}`)
          .limit(8),

        matchedCustomerIds.length
          ? supabase
              .from('dispatches')
              .select('id, dispatch_number, status, tracking_number, courier_name, eway_bill_number, customer:customers(company_name, contact_person)')
              .in('customer_id', matchedCustomerIds)
              .limit(8)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('suppliers')
          .select('id, name, contact_person, phone, email, gst_number')
          .or(`name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},email.ilike.${like},gst_number.ilike.${like}`)
          .limit(10),

        supabase
          .from('products')
          .select('id, name, category, brand, model_number, hsn_code')
          .or(`name.ilike.${like},category.ilike.${like},brand.ilike.${like},model_number.ilike.${like},hsn_code.ilike.${like}`)
          .limit(10),
      ]);

      // Process & dedupe leads
      const leadMap = new Map<string, any>();
      [...(leadsByTitleAndRef.data || []), ...(leadsByCustomer.data || [])].forEach((l) => {
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
          searchableText: [customer?.phone, customer?.email, customer?.company_name, customer?.contact_person, lead.source_reference].filter(Boolean).join(' '),
        });
      });

      // Process & dedupe customers
      if (customersResult.data) {
        customersResult.data.forEach((customer: any) => {
          const salesPerson = customer.assigned_sales?.full_name;
          const subtitleParts = [customer.contact_person || customer.phone, customer.gst_number ? `GST: ${customer.gst_number}` : null, salesPerson ? `Sales: ${salesPerson}` : null].filter(Boolean);
          searchResults.push({
            id: customer.id,
            type: 'customer',
            title: customer.company_name,
            subtitle: subtitleParts.join(' • ') || undefined,
            searchableText: [customer.phone, customer.email, customer.contact_person, customer.gst_number, salesPerson].filter(Boolean).join(' '),
          });
        });
      }

      // Process & dedupe quotations
      const quoteMap = new Map<string, any>();
      [...(quotationsByNumberAndSubject.data || []), ...(quotationsByCustomer.data || [])].forEach((q) => {
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
      [...(ordersByNumber.data || []), ...(ordersByCustomer.data || [])].forEach((o) => {
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
      [...(invoicesByNumber.data || []), ...(invoicesByCustomer.data || [])].forEach((inv) => {
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
      [...(dispatchesByNumberAndTracking.data || []), ...(dispatchesByCustomer.data || [])].forEach((d) => {
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
      if (suppliersResult.data) {
        suppliersResult.data.forEach((supplier: any) => {
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
      if (productsResult.data) {
        productsResult.data.forEach((product: any) => {
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
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
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
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, searchAll]);

  const handleSelect = (result: SearchResult) => {
    navigate(getRoute(result));
    onOpenChange(false);
    setSearch('');
    setResults([]);
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

  // Group results by type in consistent order
  const typeOrder: SearchResult['type'][] = ['lead', 'customer', 'order', 'quotation', 'invoice', 'dispatch', 'supplier', 'product'];
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
    order: 'Orders',
    quotation: 'Quotations',
    invoice: 'Invoices',
    dispatch: 'Dispatches',
    supplier: 'Suppliers',
    product: 'Products',
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search leads, customers, orders, invoices, dispatches, suppliers, products..."
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Searching across OneDesk...</span>
          </div>
        )}
        
        {!isLoading && search.trim().length >= 2 && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No results found for &ldquo;<span className="font-medium text-foreground">{search}</span>&rdquo;
          </div>
        )}

        {!isLoading && search.trim().length < 2 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search across leads, customers, orders, invoices, dispatches, suppliers, and products...
          </div>
        )}

        {!isLoading && typeOrder.filter(t => groupedResults[t]?.length).map((type, index) => {
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
