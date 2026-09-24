import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CRODetailData {
  profile: { id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
  assignments: CROAssignmentDetail[];
  leads: CROLead[];
  orders: CROOrder[];
  kpis: {
    total_assigned: number;
    contacted: number;
    enquiries: number;
    no_response: number;
    pending: number;
    contact_rate: number;
    orders_converted: number;
    revenue: number;
  };
}

export interface CROAssignmentDetail {
  id: string;
  status: string;
  notes: string | null;
  assigned_at: string;
  last_contacted_at: string | null;
  customer: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string;
    email: string | null;
    city: string | null;
    state: string | null;
  };
}

export interface CROLead {
  id: string;
  title: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_id: string | null;
  assigned_to_name: string | null;
  estimated_value: number | null;
}

export interface CROOrder {
  id: string;
  order_number: string;
  order_value: number | null;
  status: string;
  created_at: string;
  customer_name: string | null;
  lead_id: string | null;
}

export function useCRODetail(croId: string | undefined) {
  return useQuery({
    queryKey: ['cro-detail', croId],
    queryFn: async (): Promise<CRODetailData> => {
      if (!croId) throw new Error('No CRO ID');

      // Fetch profile, assignments, leads in parallel
      // Fetch profile
      const profileRes = await supabase.from('profiles').select('id, full_name, email, phone, avatar_url').eq('id', croId).single();
      if (profileRes.error) throw profileRes.error;

      // Fetch all assignments with pagination
      const PAGE_SIZE = 1000;
      const allAssignments: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('cro_customer_assignments')
          .select(`
            id, status, notes, assigned_at, last_contacted_at,
            customer:customers!inner (id, company_name, contact_person, phone, email, city, state)
          `)
          .eq('cro_user_id', croId)
          .order('assigned_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (data && data.length > 0) allAssignments.push(...data);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }

      const assignments = allAssignments as unknown as CROAssignmentDetail[];
      const uniqueCustomerIds = [...new Set(assignments.map(a => a.customer.id))];

      let leads: CROLead[] = [];
      let orders: CROOrder[] = [];

      if (uniqueCustomerIds.length > 0) {
        try {
          // Batch customer IDs in chunks of 300
          const CHUNK_SIZE = 300;
          const allLeadsData: any[] = [];
          for (let i = 0; i < uniqueCustomerIds.length; i += CHUNK_SIZE) {
            const chunk = uniqueCustomerIds.slice(i, i + CHUNK_SIZE);
            const leadsRes = await supabase
              .from('leads')
              .select(`
                id, title, status, created_at, estimated_value, customer_id,
                customer:customers(company_name),
                assigned_user:profiles!leads_assigned_to_fkey(full_name)
              `)
              .eq('source', 'cro_followup')
              .in('customer_id', chunk)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (!leadsRes.error && leadsRes.data) {
              allLeadsData.push(...leadsRes.data);
            }
          }

          leads = allLeadsData.map((l: any) => ({
            id: l.id,
            title: l.title,
            status: l.status,
            created_at: l.created_at,
            customer_name: l.customer?.company_name || 'Unknown',
            customer_id: l.customer_id,
            assigned_to_name: l.assigned_user?.full_name || null,
            estimated_value: l.estimated_value,
          }));

          // Fetch sales orders linked to won leads
          const wonLeadIds = leads.filter(l => l.status === 'won').map(l => l.id);
          if (wonLeadIds.length > 0) {
            const ordersRes = await supabase
              .from('sales_orders')
              .select('id, order_number, order_value, status, created_at, lead_id, customer:customers(company_name)')
              .in('lead_id', wonLeadIds)
              .order('created_at', { ascending: false });

            if (!ordersRes.error && ordersRes.data) {
              orders = ordersRes.data.map((o: any) => ({
                id: o.id,
                order_number: o.order_number,
                order_value: o.order_value,
                status: o.status,
                created_at: o.created_at,
                customer_name: o.customer?.company_name || null,
                lead_id: o.lead_id,
              }));
            }
          }
        } catch (err) {
          console.error('Error fetching leads/orders for CRO detail:', err);
        }
      }

      // Compute KPIs
      const total_assigned = assignments.length;
      const contacted = assignments.filter(a => a.status === 'contacted').length;
      const enquiries = assignments.filter(a => a.status === 'enquiry_received').length;
      const no_response = assignments.filter(a => a.status === 'no_response').length;
      const pending = assignments.filter(a => a.status === 'pending').length;
      const contact_rate = total_assigned > 0 ? Math.round(((contacted + enquiries) / total_assigned) * 100) : 0;
      const orders_converted = orders.length;
      const revenue = orders.reduce((sum, o) => sum + (o.order_value || 0), 0);

      return {
        profile: profileRes.data,
        assignments,
        leads,
        orders,
        kpis: { total_assigned, contacted, enquiries, no_response, pending, contact_rate, orders_converted, revenue },
      };
    },
    enabled: !!croId,
  });
}
