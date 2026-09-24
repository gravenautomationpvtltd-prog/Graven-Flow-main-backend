-- Add country and registration source columns to suppliers table for landing page tracking
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'manual';

-- Add index for filtering by country and registration source
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON public.suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_registration_source ON public.suppliers(registration_source);