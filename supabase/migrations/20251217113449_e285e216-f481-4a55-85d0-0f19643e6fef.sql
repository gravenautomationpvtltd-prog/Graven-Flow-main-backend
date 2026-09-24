-- Add executive action fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS special_discount_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_days INTEGER DEFAULT 30;

-- Add frozen field to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- Create executive actions log table for audit trail
CREATE TABLE public.executive_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL CHECK (action_type IN ('override_pricing', 'change_credit_terms', 'freeze_customer', 'unfreeze_customer', 'freeze_sku', 'unfreeze_sku', 'set_priority', 'remove_priority')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'product')),
  entity_id UUID NOT NULL,
  performed_by UUID NOT NULL,
  previous_value JSONB DEFAULT '{}'::jsonb,
  new_value JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on executive_actions_log
ALTER TABLE public.executive_actions_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view executive actions log
CREATE POLICY "Only admins can view executive actions log"
ON public.executive_actions_log
FOR SELECT
USING (is_admin_or_above(auth.uid()));

-- Only admins can create executive actions log entries
CREATE POLICY "Only admins can create executive actions log"
ON public.executive_actions_log
FOR INSERT
WITH CHECK (is_admin_or_above(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_executive_actions_entity ON public.executive_actions_log(entity_type, entity_id);
CREATE INDEX idx_executive_actions_type ON public.executive_actions_log(action_type);
CREATE INDEX idx_executive_actions_performed_by ON public.executive_actions_log(performed_by);
CREATE INDEX idx_customers_frozen ON public.customers(is_frozen) WHERE is_frozen = true;
CREATE INDEX idx_customers_priority ON public.customers(is_priority) WHERE is_priority = true;
CREATE INDEX idx_products_frozen ON public.products(is_frozen) WHERE is_frozen = true;