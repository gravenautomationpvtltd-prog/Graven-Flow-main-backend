import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PayrollSlab {
  id: string;
  min_late_minutes: number;
  max_late_minutes: number;
  deduction_type: string;
  deduction_value: number;
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  processed_at: string | null;
  processed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  approver?: {
    full_name: string;
  };
}

interface EmployeePayroll {
  id: string;
  payroll_run_id: string;
  user_id: string;
  base_salary: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  total_late_minutes: number;
  late_deduction: number;
  absence_deduction: number;
  escalation_count: number;
  escalation_penalty: number;
  leave_count: number;
  attendance_bonus: number;
  sales_commission: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface EmployeeSalary {
  id: string;
  user_id: string;
  base_salary: number;
  effective_from: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export const usePayrollSlabs = () => {
  return useQuery({
    queryKey: ['payroll-slabs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_slabs')
        .select('*')
        .order('min_late_minutes', { ascending: true });
      
      if (error) throw error;
      return data as PayrollSlab[];
    },
  });
};

export const usePayrollRuns = () => {
  return useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`
          *,
          approver:profiles!payroll_runs_approved_by_fkey (full_name)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (error) throw error;
      return data as PayrollRun[];
    },
  });
};

export const useEmployeePayroll = (payrollRunId: string | null) => {
  return useQuery({
    queryKey: ['employee-payroll', payrollRunId],
    queryFn: async () => {
      if (!payrollRunId) return [];
      
      const { data, error } = await supabase
        .from('employee_payroll')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq('payroll_run_id', payrollRunId);
      
      if (error) throw error;
      return data as EmployeePayroll[];
    },
    enabled: !!payrollRunId,
  });
};

export const useEmployeeSalaries = () => {
  return useQuery({
    queryKey: ['employee-salaries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salaries')
        .select(`
          *,
          profiles:user_id (full_name, email)
        `);
      
      if (error) throw error;
      return data as EmployeeSalary[];
    },
  });
};

export const useGeneratePayroll = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      // Get all active employees with salaries
      const { data: employees, error: empError } = await supabase
        .from('employee_salaries')
        .select(`
          user_id,
          base_salary,
          profiles:user_id (full_name, office_id)
        `);
      
      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        throw new Error('No employees with configured salaries');
      }

      // Get payroll slabs
      const { data: slabs, error: slabError } = await supabase
        .from('payroll_slabs')
        .select('*')
        .order('min_late_minutes', { ascending: true });
      
      if (slabError) throw slabError;

      // Create payroll run
      const { data: payrollRun, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          month,
          year,
          status: 'processing',
        })
        .select()
        .single();
      
      if (runError) throw runError;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      const workingDays = getWorkingDays(startDate, endDate);

      const employeePayrolls = [];

      for (const emp of employees) {
        // Get attendance records for the month
        const { data: attendance, error: attError } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', emp.user_id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
        
        if (attError) throw attError;

        // Get leave requests for the month
        const { data: leaves, error: leaveError } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', emp.user_id)
          .eq('status', 'approved')
          .or(`start_date.lte.${endDate.toISOString().split('T')[0]},end_date.gte.${startDate.toISOString().split('T')[0]}`);
        
        if (leaveError) throw leaveError;

        // Get escalation count for the month
        const { count: escalationCount, error: escError } = await supabase
          .from('escalation_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', emp.user_id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        if (escError) throw escError;

        // Get won leads for sales commission (1% of net sales)
        const { data: wonLeads, error: wonError } = await supabase
          .from('leads')
          .select('estimated_value')
          .eq('assigned_to', emp.user_id)
          .eq('status', 'won')
          .gte('won_at', startDate.toISOString())
          .lte('won_at', endDate.toISOString());
        
        if (wonError) throw wonError;

        // Calculate total net sales (excluding tax - assuming estimated_value is net)
        const totalNetSales = wonLeads?.reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0) || 0;
        
        // Sales commission at 1% of net sales
        const salesCommission = totalNetSales * 0.01;

        // Calculate attendance metrics
        const presentDays = attendance?.filter(a => a.status === 'present').length || 0;
        const lateDays = attendance?.filter(a => a.is_late).length || 0;
        const totalLateMinutes = attendance?.reduce((sum, a) => sum + (a.late_minutes || 0), 0) || 0;
        
        // Calculate leave days in this month
        const leaveCount = leaves?.reduce((sum, leave) => {
          const leaveStart = new Date(leave.start_date);
          const leaveEnd = new Date(leave.end_date);
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0);
          
          const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
          const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;
          
          return sum + Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }, 0) || 0;

        const absentDays = workingDays - presentDays - leaveCount;
        const baseSalary = Number(emp.base_salary);
        const dailyRate = baseSalary / workingDays;

        // Calculate late deduction based on slabs
        let lateDeduction = 0;
        if (slabs && totalLateMinutes > 0) {
          for (const slab of slabs) {
            if (totalLateMinutes >= slab.min_late_minutes && totalLateMinutes <= slab.max_late_minutes) {
              if (slab.deduction_type === 'fixed') {
                lateDeduction = Number(slab.deduction_value);
              } else {
                lateDeduction = baseSalary * (Number(slab.deduction_value) / 100);
              }
              break;
            }
          }
        }

        // Pro-rata absence deduction
        const absenceDeduction = Math.max(0, absentDays) * dailyRate;

        // Escalation penalty (5% for 5+ escalations)
        const escalationPenalty = (escalationCount || 0) >= 5 ? baseSalary * 0.05 : 0;

        // Attendance bonus (₹500 for zero escalations AND zero leaves)
        const attendanceBonus = ((escalationCount || 0) === 0 && leaveCount === 0) ? 500 : 0;

        const grossSalary = baseSalary + attendanceBonus + salesCommission;
        const totalDeductions = lateDeduction + absenceDeduction + escalationPenalty;
        const netSalary = grossSalary - totalDeductions;

        employeePayrolls.push({
          payroll_run_id: payrollRun.id,
          user_id: emp.user_id,
          base_salary: baseSalary,
          working_days: workingDays,
          present_days: presentDays,
          absent_days: Math.max(0, absentDays),
          late_days: lateDays,
          total_late_minutes: totalLateMinutes,
          late_deduction: lateDeduction,
          absence_deduction: absenceDeduction,
          escalation_count: escalationCount || 0,
          escalation_penalty: escalationPenalty,
          leave_count: leaveCount,
          attendance_bonus: attendanceBonus,
          sales_commission: salesCommission,
          gross_salary: grossSalary,
          total_deductions: totalDeductions,
          net_salary: netSalary,
        });
      }

      // Insert all employee payrolls
      const { error: insertError } = await supabase
        .from('employee_payroll')
        .insert(employeePayrolls);
      
      if (insertError) throw insertError;

      // Update payroll run totals
      const totals = employeePayrolls.reduce((acc, ep) => ({
        total_employees: acc.total_employees + 1,
        total_gross: acc.total_gross + ep.gross_salary,
        total_deductions: acc.total_deductions + ep.total_deductions,
        total_net: acc.total_net + ep.net_salary,
      }), { total_employees: 0, total_gross: 0, total_deductions: 0, total_net: 0 });

      const { error: updateError } = await supabase
        .from('payroll_runs')
        .update({
          ...totals,
          status: 'pending_approval',
        })
        .eq('id', payrollRun.id);
      
      if (updateError) throw updateError;

      return payrollRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Payroll generated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to generate payroll', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateEmployeeSalary = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, baseSalary }: { userId: string; baseSalary: number }) => {
      const { data, error } = await supabase
        .from('employee_salaries')
        .upsert({
          user_id: userId,
          base_salary: baseSalary,
          effective_from: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-salaries'] });
      toast({ title: 'Salary updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update salary', description: error.message, variant: 'destructive' });
    },
  });
};

export interface PayslipEmailData {
  employeeName: string;
  employeeEmail: string;
  month: string;
  year: number;
  baseSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalLateMinutes: number;
  lateDeduction: number;
  absenceDeduction: number;
  escalationCount: number;
  escalationPenalty: number;
  leaveCount: number;
  attendanceBonus: number;
  salesCommission: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

export const useSendPayslipEmail = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: PayslipEmailData) => {
      const { data: result, error } = await supabase.functions.invoke('send-payslip-email', {
        body: data,
      });
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: 'Payslip email sent successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send email', description: error.message, variant: 'destructive' });
    },
  });
};

export const useApprovePayroll = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payrollRunId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', payrollRunId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Payroll approved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve payroll', description: error.message, variant: 'destructive' });
    },
  });
};

export const useRejectPayroll = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ payrollRunId, reason }: { payrollRunId: string; reason: string }) => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', payrollRunId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Payroll rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reject payroll', description: error.message, variant: 'destructive' });
    },
  });
};

export const useFinalizePayroll = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payrollRunId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'completed',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payrollRunId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Payroll finalized successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to finalize payroll', description: error.message, variant: 'destructive' });
    },
  });
};

function getWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}
