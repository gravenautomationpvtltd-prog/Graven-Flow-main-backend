-- Create outreach_templates table for storing email and WhatsApp templates
CREATE TABLE public.outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject TEXT, -- For email only
  body TEXT NOT NULL,
  whatsapp_template_name TEXT, -- For WhatsApp only (approved template name)
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create customer_outreach table for tracking outreach campaigns
CREATE TABLE public.customer_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  campaign_date DATE NOT NULL DEFAULT CURRENT_DATE,
  email_sent_at TIMESTAMPTZ,
  whatsapp_sent_at TIMESTAMPTZ,
  email_response_at TIMESTAMPTZ,
  whatsapp_response_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email_id TEXT, -- Resend email ID for tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'failed', 'opted_out')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add outreach_opted_out field to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS outreach_opted_out BOOLEAN DEFAULT false;

-- Create index for efficient querying
CREATE INDEX idx_customer_outreach_customer_id ON public.customer_outreach(customer_id);
CREATE INDEX idx_customer_outreach_campaign_date ON public.customer_outreach(campaign_date);
CREATE INDEX idx_customer_outreach_status ON public.customer_outreach(status);
CREATE INDEX idx_outreach_templates_channel ON public.outreach_templates(channel);

-- Enable RLS
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_outreach ENABLE ROW LEVEL SECURITY;

-- RLS policies for outreach_templates
CREATE POLICY "Outreach templates viewable by authenticated users"
  ON public.outreach_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage outreach templates"
  ON public.outreach_templates FOR ALL
  USING (is_admin_or_above(auth.uid()));

-- RLS policies for customer_outreach
CREATE POLICY "Customer outreach viewable by managers and above"
  ON public.customer_outreach FOR SELECT
  USING (is_manager_or_above(auth.uid()));

CREATE POLICY "System can create outreach records"
  ON public.customer_outreach FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update outreach records"
  ON public.customer_outreach FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete outreach records"
  ON public.customer_outreach FOR DELETE
  USING (is_admin_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_outreach_templates_updated_at
  BEFORE UPDATE ON public.outreach_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_outreach_updated_at
  BEFORE UPDATE ON public.customer_outreach
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.outreach_templates (name, channel, subject, body, is_active) VALUES
('Default Email Enquiry Request', 'email', 'How can we help you today? | Graven Automation', 
'Dear {{customer_name}},

We hope you are doing well!

It has been a while since we last connected. We wanted to check if you have any upcoming requirements for:
• Industrial Automation Equipment
• PLC/HMI/SCADA Solutions
• VFDs and Servo Drives
• Technical Services

Simply reply to this email with your requirements, and your dedicated account manager {{salesperson_name}} will get back to you within 24 hours.

Best regards,
Graven Automation Team', true),
('Default WhatsApp Enquiry Request', 'whatsapp', NULL, 
'Hello {{customer_name}}! 👋

This is Graven Automation. We would love to help with any upcoming automation requirements.

Reply with your enquiry and your account manager {{salesperson_name}} will respond within 24 hours!', true);