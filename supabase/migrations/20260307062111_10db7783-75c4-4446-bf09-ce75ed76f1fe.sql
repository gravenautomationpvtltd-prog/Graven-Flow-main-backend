DROP POLICY IF EXISTS "User roles viewable by same tenant" ON public.user_roles;

CREATE POLICY "User roles viewable by same tenant"
ON public.user_roles FOR SELECT
TO authenticated
USING (is_same_tenant(user_id));