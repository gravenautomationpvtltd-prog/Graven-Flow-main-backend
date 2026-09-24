
-- Add customer_segment enum
DO $$ BEGIN
  CREATE TYPE public.customer_segment AS ENUM ('platinum', 'gold', 'silver', 'bronze', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add segment column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS segment public.customer_segment DEFAULT 'bronze';

-- Add contacted_count to cro_customer_assignments
ALTER TABLE public.cro_customer_assignments ADD COLUMN IF NOT EXISTS contacted_count integer DEFAULT 0;
