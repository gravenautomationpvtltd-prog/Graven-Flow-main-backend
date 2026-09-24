-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.offices(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  is_late BOOLEAN DEFAULT false,
  is_early_departure BOOLEAN DEFAULT false,
  late_minutes INTEGER DEFAULT 0,
  early_departure_minutes INTEGER DEFAULT 0,
  total_hours_worked NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'half_day')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Create HR role check function
CREATE OR REPLACE FUNCTION public.is_hr_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'coo', 'hr')
  )
$$;

-- Attendance RLS policies (HR/Admin only for all records, users see own)
CREATE POLICY "Users can view their own attendance"
ON public.attendance_records
FOR SELECT
USING (user_id = auth.uid() OR is_hr_or_admin(auth.uid()));

CREATE POLICY "System can insert attendance records"
ON public.attendance_records
FOR INSERT
WITH CHECK (true);

CREATE POLICY "HR/Admin can update attendance records"
ON public.attendance_records
FOR UPDATE
USING (is_hr_or_admin(auth.uid()));

CREATE POLICY "HR/Admin can delete attendance records"
ON public.attendance_records
FOR DELETE
USING (is_hr_or_admin(auth.uid()));

-- Leave requests RLS policies
CREATE POLICY "Users can view their own leave requests"
ON public.leave_requests
FOR SELECT
USING (user_id = auth.uid() OR is_hr_or_admin(auth.uid()));

CREATE POLICY "Users can create their own leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their pending leave requests"
ON public.leave_requests
FOR UPDATE
USING (
  (user_id = auth.uid() AND status = 'pending') 
  OR is_hr_or_admin(auth.uid())
);

CREATE POLICY "HR/Admin can delete leave requests"
ON public.leave_requests
FOR DELETE
USING (is_hr_or_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();