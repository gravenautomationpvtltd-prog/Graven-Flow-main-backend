
-- 1. Brand → procurement owner mapping
CREATE TABLE public.brand_procurement_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand text NOT NULL,
  procurement_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, brand)
);

ALTER TABLE public.brand_procurement_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View brand mappings same tenant"
  ON public.brand_procurement_mapping FOR SELECT
  USING (is_my_tenant(tenant_id));

CREATE POLICY "Admins manage brand mappings"
  ON public.brand_procurement_mapping FOR ALL
  USING (is_admin_or_above(auth.uid()) AND is_my_tenant(tenant_id))
  WITH CHECK (is_admin_or_above(auth.uid()) AND is_my_tenant(tenant_id));

CREATE TRIGGER trg_brand_mapping_updated
  BEFORE UPDATE ON public.brand_procurement_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Procurement round-robin tracker
CREATE TABLE public.procurement_round_robin_tracker (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.procurement_round_robin_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View round robin tracker same tenant"
  ON public.procurement_round_robin_tracker FOR SELECT
  USING (is_my_tenant(tenant_id));

-- 3. enquiry_items.pricing_status
DO $$ BEGIN
  CREATE TYPE public.enquiry_pricing_status AS ENUM ('verified_auto', 'pending', 'updated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.enquiry_items
  ADD COLUMN IF NOT EXISTS pricing_status public.enquiry_pricing_status DEFAULT 'pending';

-- 4. price_requests TAT
DO $$ BEGIN
  CREATE TYPE public.price_request_tat_status AS ENUM ('on_track', 'reminder_sent', 'escalated', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.price_requests
  ADD COLUMN IF NOT EXISTS tat_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS tat_status public.price_request_tat_status DEFAULT 'on_track';

UPDATE public.price_requests
  SET tat_deadline = created_at + interval '3 hours'
  WHERE tat_deadline IS NULL;

-- 5. Procurement assignment function
CREATE OR REPLACE FUNCTION public.assign_procurement_owner(_price_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand text;
  v_tenant_id uuid;
  v_assignee uuid;
  v_user_ids uuid[];
  v_count int;
  v_last uuid;
  v_idx int := 0;
  v_enquiry_item_id uuid;
  v_lead_id uuid;
BEGIN
  SELECT pr.enquiry_item_id, pr.lead_id INTO v_enquiry_item_id, v_lead_id
    FROM price_requests pr WHERE pr.id = _price_request_id;

  SELECT l.tenant_id INTO v_tenant_id FROM leads l WHERE l.id = v_lead_id;

  -- Try brand match
  SELECT p.brand INTO v_brand
    FROM enquiry_items ei
    LEFT JOIN products p ON p.id = ei.matched_product_id
    WHERE ei.id = v_enquiry_item_id;

  IF v_brand IS NOT NULL AND v_tenant_id IS NOT NULL THEN
    SELECT procurement_user_id INTO v_assignee
      FROM brand_procurement_mapping
      WHERE tenant_id = v_tenant_id AND lower(brand) = lower(v_brand)
      LIMIT 1;
  END IF;

  -- Fallback: round-robin among procurement users in tenant
  IF v_assignee IS NULL AND v_tenant_id IS NOT NULL THEN
    SELECT array_agg(ur.user_id ORDER BY ur.user_id) INTO v_user_ids
      FROM user_roles ur
      JOIN tenant_users tu ON tu.user_id = ur.user_id
        AND tu.tenant_id = v_tenant_id AND tu.is_active = true
      WHERE ur.role = 'procurement';

    v_count := COALESCE(array_length(v_user_ids, 1), 0);
    IF v_count > 0 THEN
      SELECT last_assigned_user_id INTO v_last
        FROM procurement_round_robin_tracker WHERE tenant_id = v_tenant_id;

      IF v_last IS NOT NULL THEN
        FOR i IN 1..v_count LOOP
          IF v_user_ids[i] = v_last THEN v_idx := i; EXIT; END IF;
        END LOOP;
      END IF;

      v_idx := (v_idx % v_count) + 1;
      v_assignee := v_user_ids[v_idx];

      INSERT INTO procurement_round_robin_tracker (tenant_id, last_assigned_user_id, updated_at)
        VALUES (v_tenant_id, v_assignee, now())
        ON CONFLICT (tenant_id) DO UPDATE
          SET last_assigned_user_id = EXCLUDED.last_assigned_user_id, updated_at = now();
    END IF;
  END IF;

  IF v_assignee IS NOT NULL THEN
    UPDATE price_requests SET assigned_to = v_assignee WHERE id = _price_request_id;
  END IF;

  RETURN v_assignee;
END;
$$;

-- 6. Trigger: set tat_deadline + auto-assign on price_requests insert
CREATE OR REPLACE FUNCTION public.trg_fn_price_request_setup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tat_deadline IS NULL THEN
    NEW.tat_deadline := COALESCE(NEW.created_at, now()) + interval '3 hours';
  END IF;
  IF NEW.tat_status IS NULL THEN
    NEW.tat_status := 'on_track';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_request_setup ON public.price_requests;
CREATE TRIGGER trg_price_request_setup
  BEFORE INSERT ON public.price_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_price_request_setup();

CREATE OR REPLACE FUNCTION public.trg_fn_price_request_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    PERFORM public.assign_procurement_owner(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_request_assign ON public.price_requests;
CREATE TRIGGER trg_price_request_assign
  AFTER INSERT ON public.price_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_price_request_assign();

-- 7. Price freshness check on enquiry insert
CREATE OR REPLACE FUNCTION public.trg_fn_enquiry_price_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_updated_at timestamptz;
  v_default_rate numeric;
BEGIN
  IF NEW.matched_product_id IS NOT NULL THEN
    SELECT price_updated_at, default_rate INTO v_price_updated_at, v_default_rate
      FROM products WHERE id = NEW.matched_product_id;

    IF v_price_updated_at IS NOT NULL
       AND v_price_updated_at >= now() - interval '30 days'
       AND COALESCE(v_default_rate, 0) > 0 THEN
      NEW.pricing_status := 'verified_auto';
      NEW.price_available := true;
      RETURN NEW;
    END IF;
  END IF;

  NEW.pricing_status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enquiry_price_check ON public.enquiry_items;
CREATE TRIGGER trg_enquiry_price_check
  BEFORE INSERT ON public.enquiry_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_enquiry_price_check();

-- 8. Auto-create price_request when enquiry inserted as pending
CREATE OR REPLACE FUNCTION public.trg_fn_enquiry_auto_price_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
BEGIN
  IF NEW.pricing_status = 'pending' THEN
    SELECT assigned_to INTO v_requester FROM leads WHERE id = NEW.lead_id;
    IF v_requester IS NULL THEN v_requester := auth.uid(); END IF;
    IF v_requester IS NOT NULL THEN
      INSERT INTO price_requests (lead_id, enquiry_item_id, requested_by, status, priority, target_rate)
        VALUES (NEW.lead_id, NEW.id, v_requester, 'pending', 'normal', NEW.target_rate)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enquiry_auto_price_request ON public.enquiry_items;
CREATE TRIGGER trg_enquiry_auto_price_request
  AFTER INSERT ON public.enquiry_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_enquiry_auto_price_request();

CREATE INDEX IF NOT EXISTS idx_price_requests_tat_deadline ON public.price_requests(tat_deadline) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_enquiry_items_pricing_status ON public.enquiry_items(pricing_status);
