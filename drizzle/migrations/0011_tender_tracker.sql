ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS published_date date,
  ADD COLUMN IF NOT EXISTS pre_bid_date date,
  ADD COLUMN IF NOT EXISTS bid_opening_date date,
  ADD COLUMN IF NOT EXISTS portal_name text,
  ADD COLUMN IF NOT EXISTS tender_fee numeric,
  ADD COLUMN IF NOT EXISTS emd_amount numeric,
  ADD COLUMN IF NOT EXISTS emd_status text,
  ADD COLUMN IF NOT EXISTS awarded_to text,
  ADD COLUMN IF NOT EXISTS award_reference text;

CREATE TABLE IF NOT EXISTS public.tender_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_documents TO authenticated;
GRANT ALL ON public.tender_documents TO service_role;

ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "BIE team reads tender documents"
ON public.tender_documents FOR SELECT TO authenticated
USING (
  public.is_my_tenant(tenant_id)
  AND (
    public.is_bie_manager(auth.uid())
    OR public.is_admin_or_above(auth.uid())
    OR EXISTS (SELECT 1 FROM public.tenders t WHERE t.id = tender_id AND t.assigned_to = auth.uid())
  )
);

CREATE POLICY "BIE team adds tender documents"
ON public.tender_documents FOR INSERT TO authenticated
WITH CHECK (
  public.is_my_tenant(tenant_id)
  AND public.is_bie_member(auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "BIE team removes tender documents"
ON public.tender_documents FOR DELETE TO authenticated
USING (
  public.is_my_tenant(tenant_id)
  AND (
    public.is_bie_manager(auth.uid())
    OR public.is_admin_or_above(auth.uid())
    OR uploaded_by = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_tender_documents_tender ON public.tender_documents(tender_id);