
-- Step 1: Add new columns to rfqs table
ALTER TABLE public.rfqs 
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS commercial_terms text;

-- Step 2: Create vendor_evaluations table
CREATE TABLE public.vendor_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES public.supplier_quotations(id) ON DELETE SET NULL,
  price_score numeric DEFAULT 0,
  delivery_score numeric DEFAULT 0,
  compliance_score numeric DEFAULT 0,
  performance_score numeric DEFAULT 0,
  weighted_total numeric DEFAULT 0,
  compliance_notes text,
  is_selected boolean DEFAULT false,
  evaluated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies using is_same_tenant
CREATE POLICY "Users can view vendor evaluations in their tenant"
  ON public.vendor_evaluations FOR SELECT
  USING (public.is_same_tenant(evaluated_by));

CREATE POLICY "Users can insert vendor evaluations"
  ON public.vendor_evaluations FOR INSERT
  WITH CHECK (auth.uid() = evaluated_by);

CREATE POLICY "Users can update vendor evaluations"
  ON public.vendor_evaluations FOR UPDATE
  USING (public.is_same_tenant(evaluated_by));

CREATE POLICY "Users can delete vendor evaluations"
  ON public.vendor_evaluations FOR DELETE
  USING (public.is_same_tenant(evaluated_by));

-- Step 3: Create rfq-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rfq-attachments', 'rfq-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for rfq-attachments
CREATE POLICY "Authenticated users can upload rfq attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rfq-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view rfq attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rfq-attachments');

CREATE POLICY "Authenticated users can update rfq attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'rfq-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete rfq attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'rfq-attachments' AND auth.role() = 'authenticated');
