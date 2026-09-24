-- Add accountability and review tracking columns to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS authorized_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS review_requested_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS review_suggestions text;

-- Update rejection_reason to be stored (already exists but ensure it's there)
-- The rejection_reason column may already exist from previous approval workflow

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);