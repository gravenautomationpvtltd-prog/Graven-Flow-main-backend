-- Optimize security helper functions with NULL checks to avoid expensive table scans/joins during unauthenticated RLS evaluation

CREATE OR REPLACE FUNCTION public.is_same_tenant(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN _target_user_id IS NULL OR auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.tenant_users t1
      JOIN public.tenant_users t2 ON t1.tenant_id = t2.tenant_id
      WHERE t1.user_id = auth.uid()
        AND t2.user_id = _target_user_id
        AND t1.is_active = true
        AND t2.is_active = true
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_same_tenant_any(VARIADIC _user_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN auth.uid() IS NULL OR _user_ids IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.tenant_users t1
      JOIN public.tenant_users t2 ON t1.tenant_id = t2.tenant_id
      WHERE t1.user_id = auth.uid()
        AND t2.user_id = ANY(_user_ids)
        AND t1.is_active = true
        AND t2.is_active = true
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('super_admin', 'coo')
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('super_admin', 'coo', 'manager')
    )
  END
$function$;
