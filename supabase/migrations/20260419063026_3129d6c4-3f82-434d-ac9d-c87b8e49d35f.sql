
-- 1. brand_owners table
CREATE TABLE public.brand_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, brand)
);
CREATE INDEX idx_brand_owners_tenant_brand ON public.brand_owners(tenant_id, lower(brand));
CREATE INDEX idx_brand_owners_owner ON public.brand_owners(owner_user_id);

ALTER TABLE public.brand_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view brand owners"
  ON public.brand_owners FOR SELECT
  USING (public.is_my_tenant(tenant_id));

CREATE POLICY "Managers can manage brand owners"
  ON public.brand_owners FOR ALL
  USING (public.is_my_tenant(tenant_id) AND public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_my_tenant(tenant_id) AND public.is_manager_or_above(auth.uid()));

CREATE TRIGGER trg_brand_owners_updated_at
  BEFORE UPDATE ON public.brand_owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. procurement_assignment_state table
CREATE TABLE public.procurement_assignment_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.procurement_assignment_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view assignment state"
  ON public.procurement_assignment_state FOR SELECT
  USING (public.is_my_tenant(tenant_id));

CREATE POLICY "Tenant members can update assignment state"
  ON public.procurement_assignment_state FOR ALL
  USING (public.is_my_tenant(tenant_id))
  WITH CHECK (public.is_my_tenant(tenant_id));

-- 3. profiles flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS round_robin_paused boolean NOT NULL DEFAULT false;

-- 4. enquiry_items new columns
ALTER TABLE public.enquiry_items
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS assigned_procurement_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routed_via text,
  ADD COLUMN IF NOT EXISTS quotation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enquiry_items_assigned_proc ON public.enquiry_items(assigned_procurement_user_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_items_brand ON public.enquiry_items(lower(brand));

-- 5. Brand detection helper
CREATE OR REPLACE FUNCTION public.detect_enquiry_brand(_matched_product_id uuid, _query_text text, _tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand text;
  v_known text;
BEGIN
  IF _matched_product_id IS NOT NULL THEN
    SELECT NULLIF(trim(brand), '') INTO v_brand FROM public.products WHERE id = _matched_product_id;
    IF v_brand IS NOT NULL THEN
      RETURN v_brand;
    END IF;
  END IF;

  IF _query_text IS NOT NULL THEN
    SELECT brand INTO v_known
    FROM public.brand_owners
    WHERE tenant_id = _tenant_id
      AND _query_text ILIKE '%' || brand || '%'
    LIMIT 1;
    IF v_known IS NOT NULL THEN
      RETURN v_known;
    END IF;

    SELECT b INTO v_known
    FROM (VALUES
      ('Siemens'), ('ABB'), ('Mitsubishi'), ('Schneider'), ('Omron'),
      ('Allen-Bradley'), ('Allen Bradley'), ('Rockwell'), ('Delta'),
      ('Phoenix Contact'), ('Pepperl+Fuchs'), ('Pepperl'), ('SICK'),
      ('Festo'), ('SMC'), ('Banner'), ('Honeywell'), ('Yokogawa'),
      ('Emerson'), ('Endress'), ('Hauser'), ('Wago'), ('Beckhoff'),
      ('Lenze'), ('Danfoss'), ('Fuji'), ('Panasonic'), ('Keyence'),
      ('Autonics'), ('Eaton'), ('L&T'), ('Larsen'), ('Bosch'), ('IFM')
    ) AS t(b)
    WHERE _query_text ILIKE '%' || b || '%'
    LIMIT 1;
    RETURN v_known;
  END IF;

  RETURN NULL;
END;
$$;

-- 6. Round-robin picker
CREATE OR REPLACE FUNCTION public.pick_next_procurement_user(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_include_manager boolean := false;
  v_users uuid[];
  v_last uuid;
  v_idx int;
  v_next uuid;
  v_count int;
BEGIN
  SELECT (setting_value = 'true') INTO v_include_manager
  FROM public.company_settings
  WHERE tenant_id = _tenant_id AND setting_key = 'include_manager_in_round_robin'
  LIMIT 1;

  SELECT array_agg(p.id ORDER BY p.id)
  INTO v_users
  FROM public.profiles p
  JOIN public.tenant_users tu ON tu.user_id = p.id AND tu.tenant_id = _tenant_id AND tu.is_active = true
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.is_active = true
    AND COALESCE(p.round_robin_paused, false) = false
    AND ur.role = 'procurement'
    AND (
      v_include_manager = true
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles ur2
        WHERE ur2.user_id = p.id AND ur2.role IN ('manager','coo','super_admin')
      )
    );

  v_count := COALESCE(array_length(v_users, 1), 0);
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT last_assigned_user_id INTO v_last
  FROM public.procurement_assignment_state
  WHERE tenant_id = _tenant_id;

  v_idx := 0;
  IF v_last IS NOT NULL THEN
    FOR i IN 1..v_count LOOP
      IF v_users[i] = v_last THEN
        v_idx := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  v_idx := (v_idx % v_count) + 1;
  v_next := v_users[v_idx];

  INSERT INTO public.procurement_assignment_state(tenant_id, last_assigned_user_id, updated_at)
  VALUES (_tenant_id, v_next, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET last_assigned_user_id = EXCLUDED.last_assigned_user_id,
        updated_at = now();

  RETURN v_next;
END;
$$;

-- 7. Trigger function
CREATE OR REPLACE FUNCTION public.auto_assign_enquiry_item_brand_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_brand text;
  v_owner uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.leads WHERE id = NEW.lead_id;
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_brand := COALESCE(NEW.brand, public.detect_enquiry_brand(NEW.matched_product_id, NEW.product_query_text, v_tenant_id));
  NEW.brand := v_brand;

  IF v_brand IS NOT NULL THEN
    SELECT owner_user_id INTO v_owner
    FROM public.brand_owners
    WHERE tenant_id = v_tenant_id AND lower(brand) = lower(v_brand)
    LIMIT 1;
  END IF;

  IF v_owner IS NOT NULL THEN
    NEW.assigned_procurement_user_id := v_owner;
    NEW.routed_via := 'brand_owner';
  ELSIF NEW.assigned_procurement_user_id IS NULL THEN
    v_owner := public.pick_next_procurement_user(v_tenant_id);
    IF v_owner IS NOT NULL THEN
      NEW.assigned_procurement_user_id := v_owner;
      NEW.routed_via := 'round_robin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_enquiry_item_ins ON public.enquiry_items;
CREATE TRIGGER trg_auto_assign_enquiry_item_ins
  BEFORE INSERT ON public.enquiry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_enquiry_item_brand_owner();

DROP TRIGGER IF EXISTS trg_auto_assign_enquiry_item_upd ON public.enquiry_items;
CREATE TRIGGER trg_auto_assign_enquiry_item_upd
  BEFORE UPDATE OF matched_product_id, product_query_text, brand
  ON public.enquiry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_enquiry_item_brand_owner();
