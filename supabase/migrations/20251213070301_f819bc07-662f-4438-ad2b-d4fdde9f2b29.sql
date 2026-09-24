-- Create integration type enum
CREATE TYPE public.integration_type AS ENUM ('indiamart', 'whatsapp', 'justdial', 'tradeindia', 'email');

-- Create integration status enum
CREATE TYPE public.integration_sync_status AS ENUM ('success', 'error', 'pending');

-- Create integration_settings table
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type public.integration_type NOT NULL UNIQUE,
  api_key TEXT,
  api_secret TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_interval_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Create integration_logs table
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type public.integration_type NOT NULL,
  status public.integration_sync_status NOT NULL DEFAULT 'pending',
  leads_synced INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for integration_settings (admin only)
CREATE POLICY "Only admins can view integration settings"
ON public.integration_settings
FOR SELECT
USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Only admins can insert integration settings"
ON public.integration_settings
FOR INSERT
WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Only admins can update integration settings"
ON public.integration_settings
FOR UPDATE
USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Only admins can delete integration settings"
ON public.integration_settings
FOR DELETE
USING (public.is_admin_or_above(auth.uid()));

-- RLS policies for integration_logs (admin only for viewing)
CREATE POLICY "Only admins can view integration logs"
ON public.integration_logs
FOR SELECT
USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "System can create integration logs"
ON public.integration_logs
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default integration settings
INSERT INTO public.integration_settings (integration_type, config) VALUES
  ('indiamart', '{"polling_enabled": false}'::jsonb),
  ('whatsapp', '{"provider": "360dialog"}'::jsonb),
  ('justdial', '{}'::jsonb),
  ('tradeindia', '{}'::jsonb),
  ('email', '{}'::jsonb);