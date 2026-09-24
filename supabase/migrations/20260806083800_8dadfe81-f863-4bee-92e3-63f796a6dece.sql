CREATE OR REPLACE FUNCTION public.can_view_supplier_quotes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('procurement','procurement_manager','import_procurement','cct','super_admin','coo','platform_admin')
  )
$$;

DROP POLICY IF EXISTS "prq_select_tenant" ON public.price_request_quotes;
CREATE POLICY "prq_select_procurement_only" ON public.price_request_quotes
  FOR SELECT TO authenticated
  USING (
    (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
    AND public.can_view_supplier_quotes(auth.uid())
  );

DROP POLICY IF EXISTS "prq_insert_procurement" ON public.price_request_quotes;
CREATE POLICY "prq_insert_procurement" ON public.price_request_quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
    AND public.can_view_supplier_quotes(auth.uid())
  );

DROP POLICY IF EXISTS "prq_update_procurement" ON public.price_request_quotes;
CREATE POLICY "prq_update_procurement" ON public.price_request_quotes
  FOR UPDATE TO authenticated
  USING (
    (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
    AND public.can_view_supplier_quotes(auth.uid())
  )
  WITH CHECK (
    (tenant_id IS NULL OR public.is_my_tenant(tenant_id))
    AND public.can_view_supplier_quotes(auth.uid())
  );