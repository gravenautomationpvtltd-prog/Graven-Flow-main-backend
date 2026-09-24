-- Create enum for procurement metrics
CREATE TYPE public.procurement_metric AS ENUM (
  'price_resolutions',
  'products_added',
  'po_count',
  'resolution_time_hours',
  'po_value'
);

-- Create enum for target period type
CREATE TYPE public.target_period_type AS ENUM (
  'monthly',
  'quarterly'
);

-- Create procurement_targets table
CREATE TABLE public.procurement_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type target_period_type NOT NULL DEFAULT 'monthly',
  year INTEGER NOT NULL,
  month INTEGER,
  quarter INTEGER,
  metric procurement_metric NOT NULL,
  target_value NUMERIC NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_month CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  CONSTRAINT valid_quarter CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  CONSTRAINT valid_period CHECK (
    (target_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (target_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  ),
  UNIQUE(user_id, target_type, year, month, quarter, metric)
);

-- Enable RLS
ALTER TABLE public.procurement_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage all procurement targets"
ON public.procurement_targets
FOR ALL
TO authenticated
USING (public.is_admin_or_above(auth.uid()))
WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Procurement users can view their own targets
CREATE POLICY "Users can view own procurement targets"
ON public.procurement_targets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Managers can view their team's targets
CREATE POLICY "Managers can view team procurement targets"
ON public.procurement_targets
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT unnest(public.get_subordinate_ids(auth.uid())))
);

-- Create trigger for updated_at
CREATE TRIGGER update_procurement_targets_updated_at
BEFORE UPDATE ON public.procurement_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_procurement_targets_user_id ON public.procurement_targets(user_id);
CREATE INDEX idx_procurement_targets_year_month ON public.procurement_targets(year, month);
CREATE INDEX idx_procurement_targets_metric ON public.procurement_targets(metric);