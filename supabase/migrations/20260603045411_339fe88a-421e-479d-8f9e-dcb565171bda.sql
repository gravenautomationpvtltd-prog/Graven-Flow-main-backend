-- A. Replace enforce_lqt_landing_zone: CRO-authored inserts stay with the creator
CREATE OR REPLACE FUNCTION public.enforce_lqt_landing_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_external_sources text[] := ARRAY['indiamart','tradeindia','whatsapp','email','website','webhook'];
  v_caller uuid := auth.uid();
  v_caller_is_lqt boolean := false;
  v_lqt_pick uuid;
  v_loyal uuid;
BEGIN
  NEW.has_enquiry := false;
  NEW.enquiry_status := NULL;

  -- Loyalty hint from linked customer (so card still shows "Account Owner")
  IF NEW.customer_id IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    SELECT assigned_sales_id INTO v_loyal
    FROM public.customers WHERE id = NEW.customer_id;
    IF v_loyal IS NOT NULL THEN
      NEW.suggested_assignee_id := v_loyal;
    END IF;
  END IF;

  -- RULE 1: Any human-authored insert by a CRO stays with the creator.
  -- Service-role inserts (webhooks, cron, edge functions) have auth.uid()=NULL
  -- and bypass this branch, so API leads still flow through round-robin.
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'cro'::public.app_role
    ) INTO v_caller_is_lqt;

    IF v_caller_is_lqt THEN
      NEW.assigned_to := v_caller;
      RETURN NEW;
    END IF;
  END IF;

  -- RULE 2: Non-external sources (e.g. manual by SPT/admin) skip LQT round-robin
  IF NOT (NEW.source::text = ANY(v_external_sources)) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NEW.suggested_assignee_id IS NULL THEN
    NEW.suggested_assignee_id := NEW.assigned_to;
  END IF;

  -- RULE 3: External-source inserts (webhooks) -> CRO round-robin pool
  v_lqt_pick := public.pick_next_lqt_user(NEW.tenant_id, NEW.vertical_id);

  IF v_lqt_pick IS NULL THEN
    SELECT user_id INTO v_lqt_pick
    FROM (
      SELECT p.id AS user_id,
             COUNT(l.id) FILTER (
               WHERE l.assigned_to = p.id
                 AND l.deleted_at IS NULL
                 AND l.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
             ) AS assigned_today,
             MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true AND tu.tenant_id = NEW.tenant_id
      LEFT JOIN public.leads l
        ON l.assigned_to = p.id
       AND l.tenant_id = NEW.tenant_id
      WHERE COALESCE(p.is_active, true) = true
        AND COALESCE(p.lead_assignment_opt_out, false) = false
        AND COALESCE(p.round_robin_paused, false) = false
        AND (
          NEW.vertical_id IS NULL OR EXISTS (
            SELECT 1 FROM public.vertical_users vu
            WHERE vu.user_id = p.id AND vu.vertical_id = NEW.vertical_id AND vu.is_active = true
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.leave_requests lr
          WHERE lr.user_id = p.id AND lr.status = 'approved'
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
        )
      GROUP BY p.id
    ) pool
    ORDER BY assigned_today ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
    LIMIT 1;
  END IF;

  IF v_lqt_pick IS NULL AND NEW.vertical_id IS NOT NULL THEN
    SELECT user_id INTO v_lqt_pick
    FROM (
      SELECT p.id AS user_id,
             COUNT(l.id) FILTER (
               WHERE l.assigned_to = p.id
                 AND l.deleted_at IS NULL
                 AND l.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
             ) AS assigned_today,
             MAX(l.created_at) FILTER (WHERE l.assigned_to = p.id) AS last_assigned_at
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'cro'::public.app_role
      JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.is_active = true AND tu.tenant_id = NEW.tenant_id
      LEFT JOIN public.leads l ON l.assigned_to = p.id AND l.tenant_id = NEW.tenant_id
      WHERE COALESCE(p.is_active, true) = true
        AND COALESCE(p.lead_assignment_opt_out, false) = false
        AND COALESCE(p.round_robin_paused, false) = false
      GROUP BY p.id
    ) pool
    ORDER BY assigned_today ASC, last_assigned_at ASC NULLS FIRST, user_id ASC
    LIMIT 1;
  END IF;

  IF v_lqt_pick IS NOT NULL THEN
    NEW.assigned_to := v_lqt_pick;
  END IF;

  RETURN NEW;
END;
$function$;

-- B. Clear stale Sweta owner hints on legacy leads
UPDATE public.leads l
SET suggested_assignee_id = c.assigned_sales_id
FROM public.customers c
WHERE l.customer_id = c.id
  AND l.suggested_assignee_id = 'e292c56d-c021-4f33-82de-32794d7a4b59'
  AND c.assigned_sales_id IS NOT NULL
  AND c.assigned_sales_id <> 'e292c56d-c021-4f33-82de-32794d7a4b59';

UPDATE public.leads
SET suggested_assignee_id = NULL
WHERE suggested_assignee_id = 'e292c56d-c021-4f33-82de-32794d7a4b59';