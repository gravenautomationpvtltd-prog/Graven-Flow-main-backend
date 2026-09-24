
-- Helper: resolve the configured procurement head for a tenant
CREATE OR REPLACE FUNCTION public.get_procurement_head(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_head uuid;
BEGIN
  SELECT NULLIF(cs.setting_value, '')::uuid INTO v_head
  FROM public.company_settings cs
  WHERE cs.tenant_id = _tenant_id
    AND cs.setting_key = 'procurement_head_user_id'
  LIMIT 1;

  IF v_head IS NULL THEN
    SELECT ur.user_id INTO v_head
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'procurement_manager'
      AND p.tenant_id = _tenant_id
      AND COALESCE(p.is_active, true) = true
    ORDER BY p.created_at
    LIMIT 1;
  END IF;

  RETURN v_head;
END;
$$;

-- Seed the setting per tenant that has a procurement manager
INSERT INTO public.company_settings (tenant_id, setting_key, setting_value, description)
SELECT DISTINCT ON (p.tenant_id) p.tenant_id, 'procurement_head_user_id', p.id::text,
       'User who receives all new price requests and distributes them to the procurement team'
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'procurement_manager'
WHERE p.tenant_id IS NOT NULL AND COALESCE(p.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.company_settings cs
    WHERE cs.tenant_id = p.tenant_id AND cs.setting_key = 'procurement_head_user_id'
  )
ORDER BY p.tenant_id, p.created_at;

-- Route new enquiry items to the procurement head
CREATE OR REPLACE FUNCTION public.auto_assign_enquiry_item_brand_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_brand text;
  v_head uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.leads WHERE id = NEW.lead_id;
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_brand := COALESCE(NEW.brand, public.detect_enquiry_brand(NEW.matched_product_id, NEW.product_query_text, v_tenant_id));
  NEW.brand := v_brand;

  -- Everything lands with the procurement head first; he distributes to the team.
  IF NEW.assigned_procurement_user_id IS NULL THEN
    v_head := public.get_procurement_head(v_tenant_id);
    IF v_head IS NOT NULL THEN
      NEW.assigned_procurement_user_id := v_head;
      NEW.routed_via := 'head';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Route new price requests to the procurement head
CREATE OR REPLACE FUNCTION public.assign_procurement_owner(_price_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_assignee uuid;
  v_enquiry_item_id uuid;
  v_lead_id uuid;
BEGIN
  SELECT pr.enquiry_item_id, pr.lead_id, pr.tenant_id
    INTO v_enquiry_item_id, v_lead_id, v_tenant_id
  FROM price_requests pr WHERE pr.id = _price_request_id;

  IF v_tenant_id IS NULL THEN
    SELECT l.tenant_id INTO v_tenant_id FROM leads l WHERE l.id = v_lead_id;
  END IF;

  SELECT ei.assigned_procurement_user_id INTO v_assignee
  FROM enquiry_items ei WHERE ei.id = v_enquiry_item_id;

  IF v_assignee IS NULL AND v_tenant_id IS NOT NULL THEN
    v_assignee := public.get_procurement_head(v_tenant_id);
  END IF;

  IF v_assignee IS NOT NULL THEN
    UPDATE price_requests SET assigned_to = v_assignee WHERE id = _price_request_id;
  END IF;

  RETURN v_assignee;
END;
$$;
