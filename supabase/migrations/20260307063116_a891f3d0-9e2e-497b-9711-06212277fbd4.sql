
-- 1. Create aggregation function for CRO assignment stats
CREATE OR REPLACE FUNCTION public.get_cro_assignment_stats(p_cro_ids uuid[])
RETURNS TABLE (
  cro_user_id uuid,
  total_assigned bigint,
  contacted bigint,
  enquiries bigint,
  no_response bigint,
  pending bigint,
  last_activity timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ca.cro_user_id,
    count(*)::bigint,
    count(*) FILTER (WHERE ca.status = 'contacted')::bigint,
    count(*) FILTER (WHERE ca.status = 'enquiry_received')::bigint,
    count(*) FILTER (WHERE ca.status = 'no_response')::bigint,
    count(*) FILTER (WHERE ca.status = 'pending')::bigint,
    max(COALESCE(ca.last_contacted_at, ca.assigned_at))
  FROM cro_customer_assignments ca
  WHERE ca.cro_user_id = ANY(p_cro_ids)
  GROUP BY ca.cro_user_id
$$;

-- 2. Clean up orphaned pending assignments from users who are no longer CROs
DELETE FROM public.cro_customer_assignments
WHERE status = 'pending'
  AND cro_user_id NOT IN (
    SELECT user_id FROM public.user_roles WHERE role = 'cro'
  );
