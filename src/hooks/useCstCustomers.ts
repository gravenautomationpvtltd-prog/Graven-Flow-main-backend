import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CstView = 'ordered' | 'quoted_silent' | 'enquired_silent'
  // legacy aliases (kept so nothing else breaks)
  | 'active' | 'recent' | 'at_risk' | 'repeat';

export interface CstCustomer {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  total_revenue: number;
  order_count: number;
  last_order_date: string | null;
  last_activity_date: string | null;
  days_since_last_order: number | null;
  days_since_last_activity: number | null;
  assigned_sales_id?: string | null;
  owner_name?: string | null;
  cst_favourite?: boolean;
  cst_dnc?: boolean;
}

const PAID_STATUSES: Array<'fulfilled' | 'ready_to_dispatch' | 'partially_fulfilled'> = [
  'fulfilled', 'ready_to_dispatch', 'partially_fulfilled',
];

const DAY_MS = 1000 * 60 * 60 * 24;

async function fetchCustomersByIds(ids: string[]) {
  if (!ids.length) return [];
  const out: Array<{
    id: string; company_name: string; contact_person: string | null;
    email: string | null; phone: string; city: string | null; state: string | null;
    assigned_sales_id: string | null;
    cst_favourite: boolean; cst_dnc: boolean;
    owner: { full_name: string | null } | null;
  }> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name, contact_person, email, phone, city, state, assigned_sales_id, cst_favourite, cst_dnc, owner:profiles!assigned_sales_id(full_name)')
      .in('id', batch)
      .is('deleted_at', null);
    if (error) throw error;
    if (data) out.push(...(data as any));
  }
  return out;
}

async function fetchLastActivityMap(customerIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!customerIds.length) return map;

  const bump = (cid: string | null | undefined, ts: string | null | undefined) => {
    if (!cid || !ts) return;
    const prev = map.get(cid);
    if (!prev || new Date(ts) > new Date(prev)) map.set(cid, ts);
  };

  for (let i = 0; i < customerIds.length; i += 100) {
    const batch = customerIds.slice(i, i + 100);
    const [leadsRes, outreachRes, quotesRes] = await Promise.all([
      supabase.from('leads')
        .select('customer_id, last_activity_at, updated_at')
        .in('customer_id', batch)
        .is('deleted_at', null),
      supabase.from('customer_outreach')
        .select('customer_id, campaign_date')
        .in('customer_id', batch),
      supabase.from('quotations')
        .select('customer_id, updated_at')
        .in('customer_id', batch)
        .is('deleted_at', null),
    ]);
    for (const l of leadsRes.data || []) bump(l.customer_id, l.last_activity_at || l.updated_at);
    for (const o of outreachRes.data || []) bump(o.customer_id, o.campaign_date);
    for (const q of quotesRes.data || []) bump(q.customer_id, q.updated_at);
  }
  return map;
}

async function loadOrderedCustomers(): Promise<CstCustomer[]> {
  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, customer_id, order_value, status, payment_status, created_at, updated_at')
    .eq('payment_status', 'received')
    .in('status', PAID_STATUSES)
    .not('customer_id', 'is', null)
    .limit(5000);
  if (error) throw error;
  if (!orders?.length) return [];

  const agg = new Map<string, { revenue: number; count: number; lastOrder: string }>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    const cur = agg.get(o.customer_id) || { revenue: 0, count: 0, lastOrder: o.updated_at };
    cur.revenue += Number(o.order_value || 0);
    cur.count += 1;
    if (new Date(o.updated_at) > new Date(cur.lastOrder)) cur.lastOrder = o.updated_at;
    agg.set(o.customer_id, cur);
  }
  const ids = Array.from(agg.keys());
  const customers = await fetchCustomersByIds(ids);
  const activity = await fetchLastActivityMap(ids);
  const now = Date.now();
  const rows: CstCustomer[] = customers.map((c) => {
    const a = agg.get(c.id)!;
    const lastAct = activity.get(c.id) || a.lastOrder;
    return {
      id: c.id,
      company_name: c.company_name,
      contact_person: c.contact_person,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      assigned_sales_id: c.assigned_sales_id,
      owner_name: c.owner?.full_name ?? null,
      cst_favourite: c.cst_favourite,
      cst_dnc: c.cst_dnc,
      total_revenue: a.revenue,
      order_count: a.count,
      last_order_date: a.lastOrder,
      last_activity_date: lastAct,
      days_since_last_order: Math.floor((now - new Date(a.lastOrder).getTime()) / DAY_MS),
      days_since_last_activity: Math.floor((now - new Date(lastAct).getTime()) / DAY_MS),
    };
  });
  rows.sort((a, b) => (b.last_order_date || '').localeCompare(a.last_order_date || ''));
  return rows;
}

async function loadQuotedSilent(minDays: number): Promise<CstCustomer[]> {
  // Customers with at least one quotation
  const { data: quotes, error } = await supabase
    .from('quotations')
    .select('customer_id')
    .not('customer_id', 'is', null)
    .is('deleted_at', null)
    .limit(10000);
  if (error) throw error;
  const quotedIds = Array.from(new Set((quotes || []).map((q) => q.customer_id).filter(Boolean) as string[]));
  if (!quotedIds.length) return [];

  const customers = await fetchCustomersByIds(quotedIds);
  const activity = await fetchLastActivityMap(quotedIds);
  const now = Date.now();
  const rows: CstCustomer[] = customers.map((c) => {
    const lastAct = activity.get(c.id) || null;
    const days = lastAct ? Math.floor((now - new Date(lastAct).getTime()) / DAY_MS) : 9999;
    return {
      id: c.id,
      company_name: c.company_name,
      contact_person: c.contact_person,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      assigned_sales_id: c.assigned_sales_id,
      owner_name: c.owner?.full_name ?? null,
      cst_favourite: c.cst_favourite,
      cst_dnc: c.cst_dnc,
      total_revenue: 0,
      order_count: 0,
      last_order_date: null,
      last_activity_date: lastAct,
      days_since_last_order: null,
      days_since_last_activity: days,
    };
  }).filter((r) => (r.days_since_last_activity ?? 0) >= minDays);
  rows.sort((a, b) => (b.days_since_last_activity ?? 0) - (a.days_since_last_activity ?? 0));
  return rows;
}

async function loadEnquiredSilent(minDays: number): Promise<CstCustomer[]> {
  // Customers with a lead but no quotation
  const [{ data: leads, error: le }, { data: quotes, error: qe }] = await Promise.all([
    supabase.from('leads').select('customer_id').not('customer_id', 'is', null).is('deleted_at', null).limit(10000),
    supabase.from('quotations').select('customer_id').not('customer_id', 'is', null).is('deleted_at', null).limit(10000),
  ]);
  if (le) throw le;
  if (qe) throw qe;
  const quoted = new Set((quotes || []).map((q) => q.customer_id).filter(Boolean) as string[]);
  const enquiredIds = Array.from(new Set((leads || [])
    .map((l) => l.customer_id)
    .filter((id): id is string => !!id && !quoted.has(id))));
  if (!enquiredIds.length) return [];

  const customers = await fetchCustomersByIds(enquiredIds);
  const activity = await fetchLastActivityMap(enquiredIds);
  const now = Date.now();
  const rows: CstCustomer[] = customers.map((c) => {
    const lastAct = activity.get(c.id) || null;
    const days = lastAct ? Math.floor((now - new Date(lastAct).getTime()) / DAY_MS) : 9999;
    return {
      id: c.id,
      company_name: c.company_name,
      contact_person: c.contact_person,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      assigned_sales_id: c.assigned_sales_id,
      owner_name: c.owner?.full_name ?? null,
      cst_favourite: c.cst_favourite,
      cst_dnc: c.cst_dnc,
      total_revenue: 0,
      order_count: 0,
      last_order_date: null,
      last_activity_date: lastAct,
      days_since_last_order: null,
      days_since_last_activity: days,
    };
  }).filter((r) => (r.days_since_last_activity ?? 0) >= minDays);
  rows.sort((a, b) => (b.days_since_last_activity ?? 0) - (a.days_since_last_activity ?? 0));
  return rows;
}

export function useCstCustomers(view: CstView = 'ordered') {
  // Normalize legacy view names
  const v: CstView =
    view === 'active' || view === 'recent' || view === 'repeat' ? 'ordered'
    : view === 'at_risk' ? 'quoted_silent'
    : view;

  return useQuery({
    queryKey: ['cst-customers', v],
    queryFn: async (): Promise<CstCustomer[]> => {
      if (v === 'ordered') return loadOrderedCustomers();
      if (v === 'quoted_silent') return loadQuotedSilent(30);
      if (v === 'enquired_silent') return loadEnquiredSilent(35);
      return [];
    },
    staleTime: 60_000,
  });
}
