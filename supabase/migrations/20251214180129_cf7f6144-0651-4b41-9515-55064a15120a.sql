-- Add new columns for vendor registration system
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS is_authorized_dealer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gst_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS pan_card_url TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_cheque_url TEXT,
  ADD COLUMN IF NOT EXISTS coi_url TEXT,
  ADD COLUMN IF NOT EXISTS msme_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_authorization_url TEXT;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);

-- Create vendor-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to vendor-documents bucket
CREATE POLICY "Anyone can upload vendor documents"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'vendor-documents');

-- Allow public read access
CREATE POLICY "Anyone can view vendor documents"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'vendor-documents');

-- Allow authenticated users to manage documents
CREATE POLICY "Authenticated can manage vendor documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'vendor-documents');

-- Allow public/anonymous inserts for vendor registration (no auth required)
CREATE POLICY "Public can register as vendors"
ON public.suppliers FOR INSERT
TO anon
WITH CHECK (status = 'pending');