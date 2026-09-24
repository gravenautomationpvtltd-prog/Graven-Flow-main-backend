
CREATE OR REPLACE FUNCTION public.customer_in_my_tenant(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = _customer_id
      AND public.is_my_tenant(c.tenant_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.customer_in_my_tenant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Sales and above can create payments" ON public.customer_payments;
CREATE POLICY "Sales and above can create payments"
ON public.customer_payments
FOR INSERT
TO authenticated
WITH CHECK (public.customer_in_my_tenant(customer_id));

DROP POLICY IF EXISTS "Sales and above can update payments" ON public.customer_payments;
CREATE POLICY "Sales and above can update payments"
ON public.customer_payments
FOR UPDATE
TO authenticated
USING (public.customer_in_my_tenant(customer_id))
WITH CHECK (public.customer_in_my_tenant(customer_id));

DROP POLICY IF EXISTS "Admins can delete payments" ON public.customer_payments;
CREATE POLICY "Admins can delete payments"
ON public.customer_payments
FOR DELETE
TO authenticated
USING (public.is_admin_or_above(auth.uid()) AND public.customer_in_my_tenant(customer_id));
