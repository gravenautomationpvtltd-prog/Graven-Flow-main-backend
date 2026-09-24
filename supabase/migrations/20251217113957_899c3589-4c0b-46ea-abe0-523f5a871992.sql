-- Create sales_targets table for monthly and quarterly targets
CREATE TABLE public.sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id),
  user_id UUID REFERENCES public.profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('monthly', 'quarterly')),
  year INTEGER NOT NULL,
  month INTEGER CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter INTEGER CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_target_period CHECK (
    (target_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (target_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

-- Enable RLS
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

-- Only admins can view targets
CREATE POLICY "Admins can view all sales targets"
ON public.sales_targets
FOR SELECT
USING (is_admin_or_above(auth.uid()));

-- Only admins can create targets
CREATE POLICY "Admins can create sales targets"
ON public.sales_targets
FOR INSERT
WITH CHECK (is_admin_or_above(auth.uid()));

-- Only admins can update targets
CREATE POLICY "Admins can update sales targets"
ON public.sales_targets
FOR UPDATE
USING (is_admin_or_above(auth.uid()));

-- Only admins can delete targets
CREATE POLICY "Admins can delete sales targets"
ON public.sales_targets
FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_sales_targets_office ON public.sales_targets(office_id);
CREATE INDEX idx_sales_targets_period ON public.sales_targets(year, month, quarter);
CREATE INDEX idx_sales_targets_type ON public.sales_targets(target_type);

-- Add trigger for updated_at
CREATE TRIGGER update_sales_targets_updated_at
BEFORE UPDATE ON public.sales_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();