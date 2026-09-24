-- Create schedule function for TradeIndia sync
CREATE OR REPLACE FUNCTION public.schedule_tradeindia_sync(cron_expression text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_exists boolean;
  sql_command text;
BEGIN
  -- Check if user is admin
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Check if job already exists
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-tradeindia-leads'
  ) INTO job_exists;

  -- If exists, unschedule first
  IF job_exists THEN
    PERFORM cron.unschedule('sync-tradeindia-leads');
  END IF;

  -- Build the SQL command for cron
  sql_command := E'SELECT net.http_post(url := \'https://iukquqmsrqnmuxpgessm.supabase.co/functions/v1/tradeindia-leads\', headers := \'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3F1cW1zcnFubXV4cGdlc3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODQyMDAsImV4cCI6MjA4MTE2MDIwMH0.ho8qHS29myxHzx4FSwjoFFH7HFQ4l9XYOch8SzrbVEc"}\'::jsonb, body := \'{"source": "cron"}\'::jsonb) AS request_id;';

  -- Schedule new job
  PERFORM cron.schedule('sync-tradeindia-leads', cron_expression, sql_command);
END;
$function$;

-- Create unschedule function for TradeIndia sync
CREATE OR REPLACE FUNCTION public.unschedule_tradeindia_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  job_exists boolean;
BEGIN
  -- Check if user is admin
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Check if job exists before unscheduling
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-tradeindia-leads'
  ) INTO job_exists;

  IF job_exists THEN
    PERFORM cron.unschedule('sync-tradeindia-leads');
  END IF;
END;
$function$;