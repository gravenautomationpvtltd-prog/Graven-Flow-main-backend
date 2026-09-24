
CREATE OR REPLACE FUNCTION public.schedule_cro_distribution(cron_expression text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  job_exists boolean;
  sql_command text;
BEGIN
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cro-daily-distribution'
  ) INTO job_exists;

  IF job_exists THEN
    PERFORM cron.unschedule('cro-daily-distribution');
  END IF;

  sql_command := E'SELECT net.http_post(url := \'https://iukquqmsrqnmuxpgessm.supabase.co/functions/v1/cro-distribute\', headers := \'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3F1cW1zcnFubXV4cGdlc3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODQyMDAsImV4cCI6MjA4MTE2MDIwMH0.ho8qHS29myxHzx4FSwjoFFH7HFQ4l9XYOch8SzrbVEc"}\'::jsonb, body := \'{"source": "cron"}\'::jsonb) AS request_id;';

  PERFORM cron.schedule('cro-daily-distribution', cron_expression, sql_command);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unschedule_cro_distribution()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  job_exists boolean;
BEGIN
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cro-daily-distribution'
  ) INTO job_exists;

  IF job_exists THEN
    PERFORM cron.unschedule('cro-daily-distribution');
  END IF;
END;
$function$;
