ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS held_quantity numeric NOT NULL DEFAULT 0;

ALTER TABLE public.goods_receipt_notes ADD COLUMN IF NOT EXISTS qc_status text;
ALTER TABLE public.goods_receipt_notes ADD COLUMN IF NOT EXISTS qc_by uuid;
ALTER TABLE public.goods_receipt_notes ADD COLUMN IF NOT EXISTS qc_at timestamptz;
ALTER TABLE public.goods_receipt_notes ADD COLUMN IF NOT EXISTS qc_notes text;

ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS qc_released_by uuid;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS qc_released_at timestamptz;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS qc_release_notes text;

CREATE POLICY "QC can release orders" ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (is_my_tenant(tenant_id) AND has_role(auth.uid(), 'qc'::app_role))
  WITH CHECK (is_my_tenant(tenant_id));

CREATE POLICY "QC can update inventory" ON public.inventory
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = inventory.product_id AND is_my_tenant(p.tenant_id)));

CREATE POLICY "QC can update GRNs" ON public.goods_receipt_notes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role))
  WITH CHECK (has_role(auth.uid(), 'qc'::app_role));

CREATE POLICY "QC can manage GRN items" ON public.grn_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'qc'::app_role))
  WITH CHECK (has_role(auth.uid(), 'qc'::app_role));