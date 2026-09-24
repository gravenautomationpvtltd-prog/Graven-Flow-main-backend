-- Create webhook_events table for logging all webhook hits
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  source_reference TEXT,
  payload JSONB,
  processing_result TEXT NOT NULL DEFAULT 'pending', -- pending, success, duplicate, failed, invalid
  error_message TEXT,
  lead_id UUID REFERENCES public.leads(id),
  customer_id UUID REFERENCES public.customers(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'coo')
  )
);

-- Create index for faster queries
CREATE INDEX idx_webhook_events_source ON public.webhook_events(source);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Drop the partial unique index and create a full unique constraint
-- This allows upsert with onConflict to work properly
DROP INDEX IF EXISTS idx_leads_source_reference_unique;

-- Create a proper unique constraint (NULLs are allowed multiple times in unique constraints)
CREATE UNIQUE INDEX idx_leads_source_reference ON public.leads(source, source_reference) 
WHERE source_reference IS NOT NULL;