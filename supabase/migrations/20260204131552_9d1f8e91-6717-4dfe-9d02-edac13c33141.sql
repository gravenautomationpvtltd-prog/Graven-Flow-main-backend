-- Add metric column to sales_targets table for individual KPI tracking
ALTER TABLE public.sales_targets 
ADD COLUMN IF NOT EXISTS metric text;

-- Update unique constraint to include metric
ALTER TABLE public.sales_targets DROP CONSTRAINT IF EXISTS sales_targets_office_id_target_type_year_month_key;
ALTER TABLE public.sales_targets DROP CONSTRAINT IF EXISTS sales_targets_unique_target;

-- Create new unique constraint that includes user_id and metric
CREATE UNIQUE INDEX IF NOT EXISTS sales_targets_user_metric_period_idx 
ON public.sales_targets (user_id, metric, target_type, year, month) 
WHERE user_id IS NOT NULL AND metric IS NOT NULL;

-- Keep office-level targets unique too
CREATE UNIQUE INDEX IF NOT EXISTS sales_targets_office_period_idx 
ON public.sales_targets (office_id, target_type, year, month) 
WHERE office_id IS NOT NULL AND metric IS NULL;