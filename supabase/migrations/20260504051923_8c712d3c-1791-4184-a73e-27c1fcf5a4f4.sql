-- 1) Ensure realtime is enabled for LQT tables (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.leads';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_qualification';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.lead_qualification REPLICA IDENTITY FULL;

-- 2) Backfill: re-route still-pending leads currently sitting on non-CRO users
--    (caused by the old webhook pre-assignment) back into the LQT pool.
WITH cro_users AS (
  SELECT user_id FROM public.user_roles WHERE role = 'cro'
),
mis_routed AS (
  SELECT l.id, l.tenant_id
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND l.assigned_to IS NOT NULL
    AND l.assigned_to NOT IN (SELECT user_id FROM cro_users)
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_qualification q WHERE q.lead_id = l.id
    )
)
UPDATE public.leads l
SET assigned_to = public.pick_next_lqt_user(m.tenant_id)
FROM mis_routed m
WHERE l.id = m.id
  AND public.pick_next_lqt_user(m.tenant_id) IS NOT NULL;