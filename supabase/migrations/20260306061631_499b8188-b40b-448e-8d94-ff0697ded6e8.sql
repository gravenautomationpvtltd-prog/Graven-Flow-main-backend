
-- Create CRO customer assignments table
CREATE TABLE public.cro_customer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cro_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  last_contacted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enquiry_received', 'no_response')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cro_user_id, customer_id)
);

-- Create CRO round robin tracker table
CREATE TABLE public.cro_round_robin_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  last_assigned_cro_id uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cro_customer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_round_robin_tracker ENABLE ROW LEVEL SECURITY;

-- RLS for cro_customer_assignments: CROs see own, admins/managers see all in tenant
CREATE POLICY "CROs see own assignments" ON public.cro_customer_assignments
  FOR SELECT TO authenticated
  USING (
    cro_user_id = auth.uid()
    OR public.is_manager_or_above(auth.uid())
  );

CREATE POLICY "CROs can update own assignments" ON public.cro_customer_assignments
  FOR UPDATE TO authenticated
  USING (cro_user_id = auth.uid() OR public.is_admin_or_above(auth.uid()))
  WITH CHECK (cro_user_id = auth.uid() OR public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert assignments" ON public.cro_customer_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_above(auth.uid()) OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "Admins can delete assignments" ON public.cro_customer_assignments
  FOR DELETE TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

-- RLS for cro_round_robin_tracker
CREATE POLICY "Admins manage round robin tracker" ON public.cro_round_robin_tracker
  FOR ALL TO authenticated
  USING (public.is_my_tenant(tenant_id))
  WITH CHECK (public.is_my_tenant(tenant_id));

-- Distribution function
CREATE OR REPLACE FUNCTION public.distribute_customers_to_cros(
  p_tenant_id uuid,
  p_stale_days integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cro_ids uuid[];
  v_cro_count integer;
  v_customer record;
  v_cro_index integer := 0;
  v_last_cro_id uuid;
  v_assigned_count integer := 0;
BEGIN
  -- Get active CRO users for this tenant
  SELECT array_agg(ur.user_id ORDER BY ur.user_id)
  INTO v_cro_ids
  FROM user_roles ur
  JOIN tenant_users tu ON tu.user_id = ur.user_id AND tu.tenant_id = p_tenant_id AND tu.is_active = true
  WHERE ur.role = 'cro';

  v_cro_count := COALESCE(array_length(v_cro_ids, 1), 0);
  
  IF v_cro_count = 0 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'No active CRO users found');
  END IF;

  -- Get last assigned CRO for round-robin continuity
  SELECT last_assigned_cro_id INTO v_last_cro_id
  FROM cro_round_robin_tracker WHERE tenant_id = p_tenant_id;

  -- Find starting index
  IF v_last_cro_id IS NOT NULL THEN
    FOR i IN 1..v_cro_count LOOP
      IF v_cro_ids[i] = v_last_cro_id THEN
        v_cro_index := i; -- will start from next
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Delete existing pending assignments (redistribute)
  DELETE FROM cro_customer_assignments 
  WHERE tenant_id = p_tenant_id AND status = 'pending';

  -- Distribute stale customers round-robin
  FOR v_customer IN
    SELECT c.id
    FROM customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM cro_customer_assignments ca
        WHERE ca.customer_id = c.id AND ca.status IN ('contacted', 'enquiry_received')
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM leads l WHERE l.customer_id = c.id AND l.created_at > now() - (p_stale_days || ' days')::interval
        )
      )
    ORDER BY c.created_at
  LOOP
    v_cro_index := (v_cro_index % v_cro_count) + 1;
    
    INSERT INTO cro_customer_assignments (cro_user_id, customer_id, tenant_id, status)
    VALUES (v_cro_ids[v_cro_index], v_customer.id, p_tenant_id, 'pending')
    ON CONFLICT (cro_user_id, customer_id) DO NOTHING;
    
    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  -- Update round-robin tracker
  INSERT INTO cro_round_robin_tracker (tenant_id, last_assigned_cro_id, updated_at)
  VALUES (p_tenant_id, v_cro_ids[v_cro_index], now())
  ON CONFLICT (tenant_id) DO UPDATE SET last_assigned_cro_id = v_cro_ids[v_cro_index], updated_at = now();

  RETURN jsonb_build_object(
    'status', 'success',
    'assigned_count', v_assigned_count,
    'cro_count', v_cro_count
  );
END;
$$;
