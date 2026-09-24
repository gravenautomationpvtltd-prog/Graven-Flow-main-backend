-- Add approval columns to payroll_runs
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add foreign key constraint for approved_by
COMMENT ON COLUMN public.payroll_runs.approved_by IS 'User who approved the payroll run';
COMMENT ON COLUMN public.payroll_runs.approved_at IS 'Timestamp when payroll was approved';
COMMENT ON COLUMN public.payroll_runs.rejection_reason IS 'Reason for rejection if payroll was rejected';