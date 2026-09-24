import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
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
}

// PostgREST .or() uses comma + parens as separators. Strip any chars the user
// types that would break the filter, plus % so we control the wildcards.
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
        return `/invoices?search=${result.title}`;
      case 'quotation':
        return `/quotations?search=${result.title}`;
      case 'dispatch':
        return `/dispatch?search=${result.title}`;
      case 'supplier':
        return `/suppliers/${result.id}`;
      case 'product':
        return `/products?search=${result.title}`;
      default:
        return '/';
    }
  };

  const searchAll = useCallback(async (rawQuery: string) => {
    const query = sanitize(rawQuery);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResult[] = [];
    const like = `%${query}%`;

    try {
      // First find customer ids matching the query — used to join leads + quotations.
      const customersResult = await supabase
        .from('customers')
        .select('id, company_name, contact_person, phone, email, assigned_sales:profiles!assigned_sales_id(full_name)')
        .or(`company_name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
        .limit(15);

      const matchedCustomerIds = (customersResult.data || []).map((c: any) => c.id);

      const [
        leadsByTitle,
        leadsByCustomer,
        quotationsByNumber,
        quotationsByCustomer,
        ordersResult,
        invoicesResult,
        dispatchesResult,
        suppliersResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('id, title, status, customer:customers(id, company_name, contact_person, phone, email)')
          .ilike('title', like)
          .limit(10),

        matchedCustomerIds.length
          ? supabase
              .from('leads')
              .select('id, title, status, customer:customers(id, company_name, contact_person, phone, email)')
              .in('customer_id', matchedCustomerIds)
              .limit(10)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('quotations')
          .select('id, quotation_number, status, total_amount, customer:customers(company_name, contact_person)')
          .ilike('quotation_number', like)
          .limit(5),

        matchedCustomerIds.length
          ? supabase
              .from('quotations')
              .select('id, quotation_number, status, total_amount, customer:customers(company_name, contact_person)')
              .in('customer_id', matchedCustomerIds)
              .limit(5)
          : Promise.resolve({ data: [] as any[] }),

        supabase
          .from('sales_orders')
          .select('id, order_number, status, order_value')
          .ilike('order_number', like)
          .limit(5),

        supabase
          .from('invoices')
          .select('id, invoice_number, status, grand_total')
          .ilike('invoice_number', like)
          .limit(5),

        supabase
          .from('dispatches')
          .select('id, dispatch_number, status, tracking_number')
          .or(`dispatch_number.ilike.${like},tracking_number.ilike.${like}`)
          .limit(5),

        supabase
          .from('suppliers')
          .select('id, name, contact_person, phone, email')
          .or(`name.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
          .limit(10),

        supabase
          .from('products')
          .select('id, name, category, brand')
          .or(`name.ilike.${like},category.ilike.${like},brand.ilike.${like}`)
          .limit(5),
      ]);

      // Merge + dedupe leads
      const leadMap = new Map<string, any>();
      [...(leadsByTitle.data || []), ...(leadsByCustomer.data || [])].forEach((l) => {
        if (!leadMap.has(l.id)) leadMap.set(l.id, l);
      });
      leadMap.forEach((lead) => {
        const customer = lead.customer as { company_name?: string; contact_person?: string; phone?: string; email?: string } | null;
        searchResults.push({
          id: lead.id,
          type: 'lead',
          title: lead.title || 'Untitled Lead',
          subtitle: customer?.company_name || customer?.contact_person || undefined,
          badge: lead.status,
          badgeVariant: lead.status === 'won' ? 'default' : lead.status === 'lost' ? 'destructive' : 'secondary',
          searchableText: [customer?.phone, customer?.email, customer?.company_name, customer?.contact_person].filter(Boolean).join(' '),
        });
      });

      // Merge + dedupe quotations
      const quoteMap = new Map<string, any>();
      [...(quotationsByNumber.data || []), ...(quotationsByCustomer.data || [])].forEach((q) => {
        if (!quoteMap.has(q.id)) quoteMap.set(q.id, q);
      });
      quoteMap.forEach((q) => {
        const c = q.customer as { company_name?: string; contact_person?: string } | null;
        searchResults.push({
          id: q.id,
          type: 'quotation',
          title: q.quotation_number,
          subtitle: c?.company_name || c?.contact_person || (q.total_amount ? `₹${Number(q.total_amount).toLocaleString('en-IN')}` : undefined),
          badge: q.status,
          badgeVariant: q.status === 'accepted' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary',
        });
      });



      // Process customers
      if (customersResult.data) {
        customersResult.data.forEach((customer) => {
          const salesPerson = (customer as any).assigned_sales?.full_name;
          const subtitleParts = [customer.contact_person || customer.phone, salesPerson ? `Sales: ${salesPerson}` : null].filter(Boolean);
          searchResults.push({
            id: customer.id,
            type: 'customer',
            title: customer.company_name,
            subtitle: subtitleParts.join(' • ') || undefined,
            searchableText: [customer.phone, customer.email, customer.contact_person, salesPerson].filter(Boolean).join(' '),
          });
        });
      }

      // Process orders
      if (ordersResult.data) {
        ordersResult.data.forEach((order) => {
          searchResults.push({
            id: order.id,
            type: 'order',
            title: order.order_number,
            subtitle: `₹${(order.order_value || 0).toLocaleString('en-IN')}`,
            badge: order.status,
            badgeVariant: order.status === 'fulfilled' ? 'default' : 'secondary',
          });
        });
      }

      // Process invoices
      if (invoicesResult.data) {
        invoicesResult.data.forEach((invoice) => {
          searchResults.push({
            id: invoice.id,
            type: 'invoice',
            title: invoice.invoice_number,
            subtitle: `₹${(invoice.grand_total || 0).toLocaleString('en-IN')}`,
            badge: invoice.status,
            badgeVariant: invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary',
          });
        });
      }

      // Process dispatches
      if (dispatchesResult.data) {
        dispatchesResult.data.forEach((dispatch) => {
          searchResults.push({
            id: dispatch.id,
            type: 'dispatch',
            title: dispatch.dispatch_number,
            subtitle: dispatch.tracking_number || undefined,
            badge: dispatch.status,
            badgeVariant: dispatch.status === 'delivered' ? 'default' : 'secondary',
          });
        });
      }

      // Process suppliers
      if (suppliersResult.data) {
        suppliersResult.data.forEach((supplier) => {
          searchResults.push({
            id: supplier.id,
            type: 'supplier',
            title: supplier.name,
            subtitle: supplier.contact_person || supplier.phone || undefined,
            searchableText: [supplier.phone, supplier.email, supplier.contact_person].filter(Boolean).join(' '),
          });
        });
      }

      // Process products
      if (productsResult.data) {
        productsResult.data.forEach((product) => {
          searchResults.push({
            id: product.id,
            type: 'product',
            title: product.name,
            subtitle: product.brand || product.category || undefined,
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
    const timer = setTimeout(() => {
      searchAll(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchAll]);

  const handleSelect = (result: SearchResult) => {
    navigate(getRoute(result));
    onOpenChange(false);
    setSearch('');
    setResults([]);
  };

  // Group results by type
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
    quotation: 'Quotations',
    order: 'Orders',
    invoice: 'Invoices',
    dispatch: 'Dispatches',
    supplier: 'Suppliers',
    product: 'Products',
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search leads, customers, orders, invoices, dispatches, suppliers, products..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!isLoading && search.length >= 2 && results.length === 0 && (
          <CommandEmpty>No results found for "{search}"</CommandEmpty>
        )}

        {!isLoading && search.length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search...
          </div>
        )}

        {!isLoading && Object.entries(groupedResults).map(([type, items], index) => (
          <div key={type}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={typeLabels[type] || type}>
              {items.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={[result.type, result.id, result.title, result.subtitle, result.searchableText].filter(Boolean).join('-')}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.title}</span>
                      {result.badge && (
                        <Badge variant={result.badgeVariant || 'secondary'} className="text-xs">
                          {result.badge}
                        </Badge>
                      )}
                    </div>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{result.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
