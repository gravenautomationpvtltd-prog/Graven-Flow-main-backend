-- Create company_settings table for storing default contact info and other company-wide settings
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies - anyone can read, only admins can modify
CREATE POLICY "Company settings are viewable by authenticated users" 
ON public.company_settings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert company settings" 
ON public.company_settings 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Only admins can update company settings" 
ON public.company_settings 
FOR UPDATE 
TO authenticated
USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Only admins can delete company settings" 
ON public.company_settings 
FOR DELETE 
TO authenticated
USING (is_admin_or_above(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.company_settings (setting_key, setting_value, description) VALUES
('default_contact_phone', '7905350134', 'Default contact phone for quotations when user has no phone'),
('default_contact_email', 'info@gravenautomation.com', 'Default contact email for quotations when user has no email');