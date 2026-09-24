-- Create email_logs table for tracking email delivery status
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  reply_to TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  complained_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Email logs viewable by authenticated users"
ON public.email_logs
FOR SELECT
USING (true);

CREATE POLICY "System can create email logs"
ON public.email_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update email logs"
ON public.email_logs
FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_email_logs_quotation_id ON public.email_logs(quotation_id);
CREATE INDEX idx_email_logs_email_id ON public.email_logs(email_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();