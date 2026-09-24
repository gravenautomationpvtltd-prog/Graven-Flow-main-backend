-- Fix affected users who were wrongly auto-checked out today
UPDATE attendance_records 
SET 
  check_out_time = NULL,
  check_out_latitude = NULL,
  check_out_longitude = NULL,
  total_hours_worked = 0,
  is_early_departure = false,
  early_departure_minutes = 0
WHERE 
  date = CURRENT_DATE 
  AND check_out_time IS NOT NULL
  AND total_hours_worked < 4;

-- Create break_records table for break management
CREATE TABLE IF NOT EXISTS public.break_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  break_type TEXT NOT NULL CHECK (break_type IN ('lunch', 'tea', 'personal', 'other')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own breaks and HR/Admin can view all
CREATE POLICY "Users can view own breaks or HR/Admin all"
ON public.break_records
FOR SELECT
USING (user_id = auth.uid() OR is_hr_or_admin(auth.uid()));

-- Users can create their own breaks
CREATE POLICY "Users can create own breaks"
ON public.break_records
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own breaks
CREATE POLICY "Users can update own breaks"
ON public.break_records
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own breaks
CREATE POLICY "Users can delete own breaks"
ON public.break_records
FOR DELETE
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_break_records_user_date ON public.break_records(user_id, created_at);
CREATE INDEX idx_break_records_attendance ON public.break_records(attendance_id);