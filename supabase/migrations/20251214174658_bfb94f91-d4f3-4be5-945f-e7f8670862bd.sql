-- Add sent_by column to email_logs table for user-specific tracking
ALTER TABLE public.email_logs ADD COLUMN sent_by uuid REFERENCES public.profiles(id);

-- Add index for efficient user-based filtering
CREATE INDEX idx_email_logs_sent_by ON public.email_logs(sent_by);