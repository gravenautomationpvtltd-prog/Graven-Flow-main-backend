-- Create payroll_slabs table for late deduction configuration
CREATE TABLE public.payroll_slabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_late_minutes INTEGER NOT NULL DEFAULT 0,
  max_late_minutes INTEGER NOT NULL,
  deduction_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' or 'percentage'
  deduction_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payroll_runs table
CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, processing, completed, cancelled
  total_employees INTEGER DEFAULT 0,
  total_gross NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  total_net NUMERIC DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Create employee_payroll table for individual payroll records
CREATE TABLE public.employee_payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  base_salary NUMERIC NOT NULL DEFAULT 0,
  working_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  late_days INTEGER DEFAULT 0,
  total_late_minutes INTEGER DEFAULT 0,
  late_deduction NUMERIC DEFAULT 0,
  absence_deduction NUMERIC DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  escalation_penalty NUMERIC DEFAULT 0,
  leave_count INTEGER DEFAULT 0,
  attendance_bonus NUMERIC DEFAULT 0,
  sales_commission NUMERIC DEFAULT 0,
  gross_salary NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, user_id)
);

-- Create employee_salaries table for base salary configuration
CREATE TABLE public.employee_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id),
  base_salary NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for payroll_slabs (admin only)
CREATE POLICY "Only admins can view payroll slabs" ON public.payroll_slabs FOR SELECT USING (is_admin_or_above(auth.uid()));
CREATE POLICY "Only admins can manage payroll slabs" ON public.payroll_slabs FOR ALL USING (is_admin_or_above(auth.uid()));

-- RLS policies for payroll_runs (HR/Admin)
CREATE POLICY "HR/Admin can view payroll runs" ON public.payroll_runs FOR SELECT USING (is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can manage payroll runs" ON public.payroll_runs FOR ALL USING (is_hr_or_admin(auth.uid()));

-- RLS policies for employee_payroll (own records or HR/Admin)
CREATE POLICY "Users can view their own payroll" ON public.employee_payroll FOR SELECT USING ((user_id = auth.uid()) OR is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can manage employee payroll" ON public.employee_payroll FOR ALL USING (is_hr_or_admin(auth.uid()));

-- RLS policies for employee_salaries (HR/Admin only)
CREATE POLICY "HR/Admin can view salaries" ON public.employee_salaries FOR SELECT USING (is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can manage salaries" ON public.employee_salaries FOR ALL USING (is_hr_or_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_payroll_slabs_updated_at BEFORE UPDATE ON public.payroll_slabs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employee_payroll_updated_at BEFORE UPDATE ON public.employee_payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employee_salaries_updated_at BEFORE UPDATE ON public.employee_salaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default payroll slabs
INSERT INTO public.payroll_slabs (min_late_minutes, max_late_minutes, deduction_type, deduction_value) VALUES
(0, 15, 'fixed', 0),
(16, 30, 'fixed', 100),
(31, 60, 'fixed', 250),
(61, 120, 'fixed', 500),
(121, 9999, 'percentage', 50);