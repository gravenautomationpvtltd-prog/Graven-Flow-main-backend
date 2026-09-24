
-- Add e-invoice columns to invoices table
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS irn TEXT,
  ADD COLUMN IF NOT EXISTS irn_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ack_number TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
  ADD COLUMN IF NOT EXISTS einvoice_status TEXT DEFAULT 'pending';

-- Add e-way bill columns to dispatches table
ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS eway_bill_number TEXT,
  ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eway_bill_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eway_bill_status TEXT DEFAULT 'pending';

-- Create GST API settings table
CREATE TABLE IF NOT EXISTS public.gst_api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gstin TEXT NOT NULL,
  gsp_provider TEXT NOT NULL DEFAULT 'iris',
  api_username TEXT,
  api_password TEXT,
  sandbox_mode BOOLEAN DEFAULT true,
  auto_generate_einvoice BOOLEAN DEFAULT false,
  auto_generate_eway_bill BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.gst_api_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for gst_api_settings
CREATE POLICY "Users can view own tenant GST settings"
  ON public.gst_api_settings
  FOR SELECT
  TO authenticated
  USING (is_my_tenant(tenant_id));

CREATE POLICY "Admins can manage GST settings"
  ON public.gst_api_settings
  FOR ALL
  TO authenticated
  USING (is_my_tenant(tenant_id) AND (is_admin_or_above(auth.uid()) OR has_role(auth.uid(), 'accounts')))
  WITH CHECK (is_my_tenant(tenant_id) AND (is_admin_or_above(auth.uid()) OR has_role(auth.uid(), 'accounts')));
