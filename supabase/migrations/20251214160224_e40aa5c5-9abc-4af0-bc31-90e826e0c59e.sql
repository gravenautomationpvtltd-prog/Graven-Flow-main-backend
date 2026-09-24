-- Create integration_accounts table for multiple API accounts per integration
CREATE TABLE public.integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_setting_id uuid REFERENCES public.integration_settings(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'default',
  userid text,
  profile_id text,
  api_key text NOT NULL,
  is_enabled boolean DEFAULT true,
  last_sync_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX idx_integration_accounts_setting ON public.integration_accounts(integration_setting_id);
CREATE INDEX idx_integration_accounts_type ON public.integration_accounts(account_type);
CREATE INDEX idx_integration_accounts_enabled ON public.integration_accounts(is_enabled);

-- Enable RLS
ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;

-- Admin only policies
CREATE POLICY "Admins can view integration accounts"
  ON public.integration_accounts FOR SELECT
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert integration accounts"
  ON public.integration_accounts FOR INSERT
  WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update integration accounts"
  ON public.integration_accounts FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete integration accounts"
  ON public.integration_accounts FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_integration_accounts_updated_at
  BEFORE UPDATE ON public.integration_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();