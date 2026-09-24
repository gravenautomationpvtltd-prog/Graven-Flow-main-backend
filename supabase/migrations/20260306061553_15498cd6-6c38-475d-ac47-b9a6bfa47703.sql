
-- 1. Add 'cro' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cro';

-- 2. Add 'cro_followup' to lead_source enum
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'cro_followup';
