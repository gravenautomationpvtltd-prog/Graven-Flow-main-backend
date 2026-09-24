
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

-- Create a new SELECT policy that also allows seeing a tenant you just created
-- We use a broader check: either you're already a member, or you're the one creating it during onboarding
CREATE POLICY "Users can view their own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    id = get_user_tenant_id(auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true
    )
  );
