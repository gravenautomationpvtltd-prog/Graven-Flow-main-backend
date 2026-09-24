CREATE POLICY "BIE can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  is_my_tenant(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (ur.role)::text = ANY (ARRAY['bie'::text, 'bie_manager'::text])
  )
);