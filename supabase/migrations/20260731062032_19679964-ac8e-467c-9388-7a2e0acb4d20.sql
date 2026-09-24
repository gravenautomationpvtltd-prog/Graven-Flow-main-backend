CREATE OR REPLACE FUNCTION public.is_procurement_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'coo', 'procurement', 'procurement_manager', 'import_procurement', 'cct')
  )
$$;

CREATE OR REPLACE FUNCTION public.branch_guard(_office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_branch_scoped_role(auth.uid())
    OR public.current_user_office_id() IS NULL
    OR _office_id IS NULL
    OR _office_id = public.current_user_office_id();
$$;