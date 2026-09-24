-- Add DELETE RLS policies for tables that are missing them
-- These allow super_admin/coo to delete dependent records before deleting parent entities

-- 1. Add DELETE policy for escalation_logs
CREATE POLICY "Admins can delete escalation logs"
  ON public.escalation_logs FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- 2. Add DELETE policy for webhook_events (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
    EXECUTE 'CREATE POLICY "Admins can delete webhook events" ON public.webhook_events FOR DELETE TO authenticated USING (public.is_admin_or_above(auth.uid()))';
  END IF;
END $$;

-- 3. Add DELETE policy for customer_outreach
CREATE POLICY "Admins can delete customer outreach"
  ON public.customer_outreach FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));