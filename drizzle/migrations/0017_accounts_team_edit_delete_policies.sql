-- Allow the accounts team (in addition to admins) to delete finance records

CREATE POLICY "Accounts can delete purchase bills"
ON public.purchase_bills FOR DELETE
USING (is_my_tenant(tenant_id) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));

CREATE POLICY "Accounts can delete expenses"
ON public.expenses FOR DELETE
USING (is_my_tenant(tenant_id) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));

CREATE POLICY "Accounts can delete fixed assets"
ON public.fixed_assets FOR DELETE
USING (is_my_tenant(tenant_id) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));

CREATE POLICY "Accounts can delete customer payments"
ON public.customer_payments FOR DELETE
USING (customer_in_my_tenant(customer_id) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));

CREATE POLICY "Accounts can delete supplier payments"
ON public.supplier_payments FOR DELETE
USING (
  (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by))
);

CREATE POLICY "Accounts can update supplier payments"
ON public.supplier_payments FOR UPDATE
USING (
  (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid()))
  AND EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_payments.supplier_id AND is_same_tenant(s.created_by))
);

CREATE POLICY "Accounts can delete invoices"
ON public.invoices FOR DELETE
USING (is_same_tenant(created_by) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));

CREATE POLICY "Accounts can update invoices"
ON public.invoices FOR UPDATE
USING (is_same_tenant(created_by) AND (has_role(auth.uid(), 'accounts'::app_role) OR is_admin_or_above(auth.uid())));