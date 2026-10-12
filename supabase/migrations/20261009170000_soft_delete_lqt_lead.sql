-- Migration: 20261009170000_soft_delete_lqt_lead.sql
-- Description: Convert delete_lqt_lead from destructive hard-delete to safe soft-delete/trash.
-- Prevents deleted leads from being re-imported by IndiaMART/TradeIndia sync workers
-- and prevents unintended Round Robin reassignment to Saniya or Sweta.

CREATE OR REPLACE FUNCTION public.delete_lqt_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_lead record;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_assigned boolean := false;
  v_can_delete boolean := false;
BEGIN
  -- 1. Ensure authenticated caller
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED: Authentication required to delete leads.';
  END IF;

  -- 2. Find target lead
  SELECT id, title, source, source_reference, customer_id, tenant_id, assigned_to, deleted_at
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND: Lead % does not exist.', p_lead_id;
  END IF;

  IF v_lead.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LEAD_ALREADY_DELETED: Lead % is already in trash.', p_lead_id;
  END IF;

  -- 3. Tenant Isolation Check:
  -- Verify the caller is an active member of the lead's tenant (or default tenant if NULL),
  -- or has platform_admin / super_admin privileges.
  -- This correctly supports users with multiple tenant memberships without arbitrary LIMIT 1 pick,
  -- and ensures no NULL-tenant bypass or cross-tenant deletion is possible.
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE user_id = v_user
        AND tenant_id = COALESCE(v_lead.tenant_id, '1a5184ef-5138-4327-8928-67bc4f229131'::uuid)
        AND is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_user
        AND role::text IN ('super_admin', 'platform_admin')
    )
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: User is not an active member of this lead''s tenant.';
  END IF;

  -- 4. Authorization check: Admins (super_admin, platform_admin, coo), Managers, or the assigned CRO agent can delete
  v_is_admin := (public.is_admin_or_above(v_user) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role::text = 'platform_admin'
  ));
  v_is_manager := public.is_manager_or_above(v_user);
  v_is_assigned := (v_lead.assigned_to = v_user);

  v_can_delete := (v_is_admin OR v_is_manager OR v_is_assigned);

  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: You are not authorized to delete this lead.';
  END IF;

  -- 5. Safe Soft-Delete:
  -- Keep the row in public.leads with source_reference intact so background
  -- sync workers (IndiaMART/TradeIndia) recognize it as existing and never re-import it.
  UPDATE public.leads
  SET deleted_at = now(),
      deleted_by = v_user,
      updated_at = now()
  WHERE id = p_lead_id;

  -- 6. Deactivate active qualification record if present
  UPDATE public.lead_qualification
  SET is_active = false
  WHERE lead_id = p_lead_id AND is_active = true;

  -- 7. Log audit history in lead_assignment_history
  INSERT INTO public.lead_assignment_history (
    tenant_id,
    lead_id,
    assigned_from,
    assigned_to,
    changed_by,
    reason,
    assignment_source
  ) VALUES (
    COALESCE(v_lead.tenant_id, '1a5184ef-5138-4327-8928-67bc4f229131'::uuid),
    p_lead_id,
    v_lead.assigned_to,
    v_lead.assigned_to,
    v_user,
    'lead_deleted_to_trash',
    'lqt_delete'
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_lead_id', p_lead_id,
    'deleted_by', v_user,
    'deleted_at', now()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_lqt_lead(uuid) TO authenticated;
