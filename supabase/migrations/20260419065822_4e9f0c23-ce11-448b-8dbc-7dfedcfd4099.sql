
CREATE OR REPLACE FUNCTION public.assign_procurement_owner(_price_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_brand text;
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

  SELECT COALESCE(ei.brand, p.brand), ei.assigned_procurement_user_id
    INTO v_brand, v_assignee
  FROM enquiry_items ei
  LEFT JOIN products p ON p.id = ei.matched_product_id
  WHERE ei.id = v_enquiry_item_id;

  IF v_assignee IS NULL AND v_brand IS NOT NULL AND v_tenant_id IS NOT NULL THEN
    SELECT owner_user_id INTO v_assignee
    FROM brand_owners
    WHERE tenant_id = v_tenant_id AND lower(brand) = lower(v_brand)
    LIMIT 1;
  END IF;

  IF v_assignee IS NULL AND v_tenant_id IS NOT NULL THEN
    v_assignee := pick_next_procurement_user(v_tenant_id);
  END IF;

  IF v_assignee IS NOT NULL THEN
    UPDATE price_requests SET assigned_to = v_assignee WHERE id = _price_request_id;
  END IF;

  RETURN v_assignee;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_price_request_for_enquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_requested_by uuid;
  v_pricing_status text;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM price_requests WHERE enquiry_item_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_pricing_status := COALESCE(NEW.pricing_status::text, '');
  IF v_pricing_status = 'verified_auto' THEN
    RETURN NEW;
  END IF;

  SELECT l.tenant_id, l.assigned_to
    INTO v_tenant_id, v_requested_by
  FROM public.leads l WHERE l.id = NEW.lead_id;

  IF v_tenant_id IS NULL THEN
    RAISE LOG 'auto_create_price_request_for_enquiry: tenant_id NULL for lead %', NEW.lead_id;
    RETURN NEW;
  END IF;

  IF v_requested_by IS NULL THEN
    v_requested_by := COALESCE(auth.uid(), NEW.price_flagged_by);
  END IF;

  IF v_requested_by IS NULL THEN
    RAISE LOG 'auto_create_price_request_for_enquiry: requested_by NULL for enquiry_item %', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.price_requests (
      lead_id, enquiry_item_id, requested_by, status, priority,
      tenant_id, target_rate, assigned_to
    ) VALUES (
      NEW.lead_id,
      NEW.id,
      v_requested_by,
      'pending',
      'normal',
      v_tenant_id,
      NEW.target_rate,
      NEW.assigned_procurement_user_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'auto_create_price_request_for_enquiry failed for %: %', NEW.id, SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_create_price_request_for_enquiry ON public.enquiry_items;
CREATE TRIGGER trg_auto_create_price_request_for_enquiry
AFTER INSERT ON public.enquiry_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_price_request_for_enquiry();

INSERT INTO public.price_requests (
  lead_id, enquiry_item_id, requested_by, status, priority,
  tenant_id, target_rate, assigned_to, requested_at
)
SELECT
  ei.lead_id,
  ei.id,
  COALESCE(l.assigned_to, ei.price_flagged_by) AS requested_by,
  'pending'::price_request_status,
  'normal',
  l.tenant_id,
  ei.target_rate,
  ei.assigned_procurement_user_id,
  ei.created_at
FROM public.enquiry_items ei
JOIN public.leads l ON l.id = ei.lead_id
LEFT JOIN public.price_requests pr ON pr.enquiry_item_id = ei.id
WHERE pr.id IS NULL
  AND ei.created_at >= '2026-04-17'::timestamptz
  AND COALESCE(ei.pricing_status::text, '') <> 'verified_auto'
  AND l.tenant_id IS NOT NULL
  AND COALESCE(l.assigned_to, ei.price_flagged_by) IS NOT NULL;
