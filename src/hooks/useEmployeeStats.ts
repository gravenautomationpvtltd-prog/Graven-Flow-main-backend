import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  employment_status: string | null;
  exit_date: string | null;
  exit_reason: string | null;
  office_id: string | null;
  manager_id: string | null;
  created_at: string;
  office?: {
    id: string;
    name: string;
    location: string;
  } | null;
  roles: { role: string }[];
}

export interface EmployeeStats {
  leadCount: number;
  customerCount: number;
  orderCount: number;
  totalRevenue: number;
  taskCount: number;
  completedTaskCount: number;
  attendanceRate: number;
  escalationCount: number;
  conversionRate: number;
  quotationCount: number;
}

export interface DateRangeParam {
  from?: Date;
  to?: Date;
}

export function useEmployeeProfile(employeeId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['employee-profile', employeeId, session?.access_token],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          office:offices(id, name, location)
        `)
        .eq('id', employeeId)
        .single();

      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', employeeId);

      return {
        ...profile,
        roles: roles || [],
      } as EmployeeProfile;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeStats(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-stats', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      // Helper to apply date filters
      const applyDateFilter = (query: any, column: string = 'created_at') => {
        if (fromISO) query = query.gte(column, fromISO);
        if (toISO) query = query.lte(column, toISO);
        return query;
      };

      // Fetch leads count
      let leadsQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', employeeId);
      leadsQuery = applyDateFilter(leadsQuery);
      const { count: leadCount } = await leadsQuery;

      // Fetch won leads for conversion rate
      let wonQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', employeeId)
        .eq('status', 'won');
      wonQuery = applyDateFilter(wonQuery);
      const { count: wonLeadCount } = await wonQuery;

      // Fetch customers count
      let custQuery = supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_sales_id', employeeId);
      custQuery = applyDateFilter(custQuery);
      const { count: customerCount } = await custQuery;

      // Fetch orders and revenue - orders linked via leads
      let leadsForOrders = supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', employeeId);
      leadsForOrders = applyDateFilter(leadsForOrders);
      const { data: leads } = await leadsForOrders;

      const leadIds = leads?.map((l) => l.id) || [];
      
      let orderCount = 0;
      let totalRevenue = 0;
      
      if (leadIds.length > 0) {
        let ordersQuery = supabase
          .from('sales_orders')
          .select('id, order_value')
          .in('lead_id', leadIds);
        ordersQuery = applyDateFilter(ordersQuery);
        const { data: orders } = await ordersQuery;

        orderCount = orders?.length || 0;
        totalRevenue = orders?.reduce((sum, o) => sum + (o.order_value || 0), 0) || 0;
      }

      // Fetch quotations count
      let quotQuery = supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', employeeId);
      quotQuery = applyDateFilter(quotQuery);
      const { count: quotationCount } = await quotQuery;

      // Fetch tasks count
      let taskQuery = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', employeeId);
      taskQuery = applyDateFilter(taskQuery);
      const { count: taskCount } = await taskQuery;

      let completedTaskQuery = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', employeeId)
        .eq('status', 'completed');
      completedTaskQuery = applyDateFilter(completedTaskQuery);
      const { count: completedTaskCount } = await completedTaskQuery;

      // Fetch escalations count
      let escQuery = supabase
        .from('escalation_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', employeeId);
      escQuery = applyDateFilter(escQuery);
      const { count: escalationCount } = await escQuery;

      // Fetch attendance rate
      let attQuery = supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', employeeId)
        .in('status', ['present', 'late']);
      
      if (fromISO) {
        attQuery = attQuery.gte('date', fromISO.split('T')[0]);
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        attQuery = attQuery.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
      }
      if (toISO) {
        attQuery = attQuery.lte('date', toISO.split('T')[0]);
      }
      const { count: presentDays } = await attQuery;

      // Calculate conversion rate
      const conversionRate = leadCount && leadCount > 0 
        ? ((wonLeadCount || 0) / leadCount) * 100 
        : 0;

      // Attendance rate (assuming 22 working days in 30 days)
      const attendanceRate = presentDays ? (presentDays / 22) * 100 : 0;

      return {
        leadCount: leadCount || 0,
        customerCount: customerCount || 0,
        orderCount,
        totalRevenue,
        taskCount: taskCount || 0,
        completedTaskCount: completedTaskCount || 0,
        quotationCount: quotationCount || 0,
        escalationCount: escalationCount || 0,
        conversionRate: Math.min(conversionRate, 100),
        attendanceRate: Math.min(attendanceRate, 100),
      } as EmployeeStats;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeLeads(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-leads', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          customer:customers(id, company_name, contact_person)
        `)
        .eq('assigned_to', employeeId)
        .order('created_at', { ascending: false });

      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeCustomers(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-customers', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('assigned_sales_id', employeeId)
        .order('created_at', { ascending: false });

      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeOrders(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-orders', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      let leadsQuery = supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', employeeId);

      const { data: leads } = await leadsQuery;
      const leadIds = leads?.map((l) => l.id) || [];
      
      if (leadIds.length === 0) return [];

      let query = supabase
        .from('sales_orders')
        .select(`
          *,
          lead:leads(id, title, customer:customers(id, company_name))
        `)
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeTasks(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-tasks', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          lead:leads(id, title),
          customer:customers(id, company_name)
        `)
        .eq('assigned_to', employeeId)
        .order('created_at', { ascending: false });

      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeAttendance(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromDate = dateRange?.from ? dateRange.from.toISOString().split('T')[0] : undefined;
  const toDate = dateRange?.to ? dateRange.to.toISOString().split('T')[0] : undefined;

  return useQuery({
    queryKey: ['employee-attendance', employeeId, fromDate, toDate, session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          office:offices(id, name)
        `)
        .eq('user_id', employeeId)
        .order('date', { ascending: false });

      if (fromDate) {
        query = query.gte('date', fromDate);
      }
      if (toDate) {
        query = query.lte('date', toDate);
      }
      if (!fromDate && !toDate) {
        query = query.limit(60);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}
