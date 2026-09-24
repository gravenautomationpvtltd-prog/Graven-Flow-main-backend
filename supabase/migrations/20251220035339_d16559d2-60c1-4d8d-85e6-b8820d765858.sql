-- Create WhatsApp templates table for storing AiSensy campaign templates
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  description TEXT,
  template_params JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for managers and above
CREATE POLICY "WhatsApp templates viewable by managers and above"
ON public.whatsapp_templates
FOR SELECT
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can create WhatsApp templates"
ON public.whatsapp_templates
FOR INSERT
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update WhatsApp templates"
ON public.whatsapp_templates
FOR UPDATE
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete WhatsApp templates"
ON public.whatsapp_templates
FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default template
INSERT INTO public.whatsapp_templates (name, campaign_name, description, is_default, is_active)
VALUES ('Marketing Template', 'marketing_english_19_12_2025_5726', 'Default marketing template for customer outreach', true, true);