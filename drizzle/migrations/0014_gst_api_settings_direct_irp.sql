-- Add direct IRP provider fields to gst_api_settings
ALTER TABLE public.gst_api_settings
  ADD COLUMN IF NOT EXISTS provider_mode text DEFAULT 'gsp',
  ADD COLUMN IF NOT EXISTS irp_base_url text,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text;

COMMENT ON COLUMN public.gst_api_settings.provider_mode IS 'gsp or direct_irp';
COMMENT ON COLUMN public.gst_api_settings.irp_base_url IS 'One of the 6 government IRP base URLs (einvoice1..einvoice6.gst.gov.in)';
COMMENT ON COLUMN public.gst_api_settings.client_id IS 'IRP portal Client ID for direct government API';
COMMENT ON COLUMN public.gst_api_settings.client_secret IS 'IRP portal Client Secret for direct government API';
