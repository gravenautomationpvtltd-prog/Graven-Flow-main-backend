-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Email templates viewable by authenticated users"
ON public.email_templates
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage email templates"
ON public.email_templates
FOR ALL
USING (is_manager_or_above(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default template
INSERT INTO public.email_templates (name, subject, body, is_default)
VALUES (
  'Standard Quotation',
  'Quotation {{quotation_number}} from Graven Automation',
  'Dear {{customer_name}},

Please find attached our quotation {{quotation_number}} for your reference.

Quotation Details:
- Subject: {{subject}}
- Valid Until: {{valid_until}}
- Grand Total: ₹{{grand_total}}

If you have any questions, please feel free to contact us.

Best regards,
{{sender_name}}
Graven Automation',
  true
);