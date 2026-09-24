
-- Step 1: Add tenant_id column to integration_logs
ALTER TABLE public.integration_logs 
ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- Step 2: Backfill all existing logs to Graven Automation's tenant (only active tenant with integrations)
UPDATE public.integration_logs 
SET tenant_id = '1a5184ef-5138-4327-8928-67bc4f229131';

-- Step 3: Drop existing RLS policies on integration_logs
DROP POLICY IF EXISTS "Admins can view integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "System can insert integration logs" ON public.integration_logs;
DROP POLICY IF EXISTS "System can update integration logs" ON public.integration_logs;

-- Step 4: Create tenant-scoped RLS policies
CREATE POLICY "Tenant-scoped integration logs SELECT" 
ON public.integration_logs 
FOR SELECT 
USING (is_my_tenant(tenant_id) AND is_admin_or_above(auth.uid()));

CREATE POLICY "Service role can insert integration logs" 
ON public.integration_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update integration logs" 
ON public.integration_logs 
FOR UPDATE 
USING (true);

-- Step 5: Add index for tenant_id
CREATE INDEX idx_integration_logs_tenant_id ON public.integration_logs(tenant_id);
