-- Add lead assignment opt-out column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lead_assignment_opt_out BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.lead_assignment_opt_out IS 'When true, user is excluded from automatic lead assignment round-robin';