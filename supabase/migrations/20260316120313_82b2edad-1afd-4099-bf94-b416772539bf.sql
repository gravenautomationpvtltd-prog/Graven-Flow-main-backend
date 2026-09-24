CREATE OR REPLACE FUNCTION public.find_potential_duplicate_customer(p_phone text, p_email text DEFAULT NULL::text, p_company_name text DEFAULT NULL::text, p_gst_number text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(customer_id uuid, company_name text, phone text, email text, state text, city text, gst_number text, assigned_sales_id uuid, assigned_sales_name text, match_score integer, match_reasons text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone text;
  v_tenant_id uuid;
BEGIN
  -- Resolve caller's tenant
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  -- Normalize the input phone (keep only last 10 digits)
  normalized_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(normalized_phone) > 10 THEN
    normalized_phone := right(normalized_phone, 10);
  END IF;

  RETURN QUERY
  WITH customer_matches AS (
    SELECT 
      c.id,
      c.company_name,
      c.phone,
      c.email,
      c.state,
      c.city,
      c.gst_number,
      c.assigned_sales_id,
      p.full_name as sales_name,
      right(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g'), 10) as normalized_cust_phone
    FROM customers c
    LEFT JOIN profiles p ON c.assigned_sales_id = p.id
    WHERE (p_exclude_id IS NULL OR c.id != p_exclude_id)
      AND c.deleted_at IS NULL
      AND c.tenant_id = v_tenant_id
  )
  SELECT 
    cm.id as customer_id,
    cm.company_name,
    cm.phone,
    cm.email,
    cm.state,
    cm.city,
    cm.gst_number,
    cm.assigned_sales_id,
    cm.sales_name as assigned_sales_name,
    (
      CASE WHEN p_gst_number IS NOT NULL 
           AND cm.gst_number IS NOT NULL 
           AND UPPER(TRIM(p_gst_number)) = UPPER(TRIM(cm.gst_number))
           AND LENGTH(TRIM(p_gst_number)) > 5
      THEN 100 ELSE 0 END
      +
      CASE WHEN normalized_phone IS NOT NULL 
           AND cm.normalized_cust_phone IS NOT NULL
           AND LENGTH(normalized_phone) >= 10
           AND normalized_phone = cm.normalized_cust_phone
      THEN 50 ELSE 0 END
      +
      CASE WHEN p_email IS NOT NULL 
           AND cm.email IS NOT NULL 
           AND LOWER(TRIM(p_email)) = LOWER(TRIM(cm.email))
           AND LENGTH(TRIM(p_email)) > 5
      THEN 40 ELSE 0 END
      +
      CASE WHEN p_company_name IS NOT NULL 
           AND cm.company_name IS NOT NULL
           AND p_state IS NOT NULL
           AND cm.state IS NOT NULL
           AND LOWER(TRIM(p_company_name)) = LOWER(TRIM(cm.company_name))
           AND LOWER(TRIM(p_state)) = LOWER(TRIM(cm.state))
      THEN 30 ELSE 0 END
      +
      CASE WHEN p_company_name IS NOT NULL 
           AND cm.company_name IS NOT NULL
           AND p_city IS NOT NULL
           AND cm.city IS NOT NULL
           AND LOWER(TRIM(p_company_name)) = LOWER(TRIM(cm.company_name))
           AND LOWER(TRIM(p_city)) = LOWER(TRIM(cm.city))
      THEN 25 ELSE 0 END
      +
      CASE WHEN p_company_name IS NOT NULL 
           AND cm.company_name IS NOT NULL
           AND LOWER(TRIM(p_company_name)) = LOWER(TRIM(cm.company_name))
           AND (p_state IS NULL OR cm.state IS NULL OR LOWER(TRIM(p_state)) != LOWER(TRIM(cm.state)))
      THEN 10 ELSE 0 END
    )::int as match_score,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN p_gst_number IS NOT NULL 
           AND cm.gst_number IS NOT NULL 
           AND UPPER(TRIM(p_gst_number)) = UPPER(TRIM(cm.gst_number))
           AND LENGTH(TRIM(p_gst_number)) > 5
      THEN 'GST Number' ELSE NULL END,
      CASE WHEN normalized_phone IS NOT NULL 
           AND cm.normalized_cust_phone IS NOT NULL
           AND LENGTH(normalized_phone) >= 10
           AND normalized_phone = cm.normalized_cust_phone
      THEN 'Phone' ELSE NULL END,
      CASE WHEN p_email IS NOT NULL 
           AND cm.email IS NOT NULL 
           AND LOWER(TRIM(p_email)) = LOWER(TRIM(cm.email))
           AND LENGTH(TRIM(p_email)) > 5
      THEN 'Email' ELSE NULL END,
      CASE WHEN p_company_name IS NOT NULL 
           AND cm.company_name IS NOT NULL
           AND LOWER(TRIM(p_company_name)) = LOWER(TRIM(cm.company_name))
      THEN 'Company Name' ELSE NULL END,
      CASE WHEN p_state IS NOT NULL 
           AND cm.state IS NOT NULL
           AND LOWER(TRIM(p_state)) = LOWER(TRIM(cm.state))
      THEN 'State' ELSE NULL END,
      CASE WHEN p_city IS NOT NULL 
           AND cm.city IS NOT NULL
           AND LOWER(TRIM(p_city)) = LOWER(TRIM(cm.city))
      THEN 'City' ELSE NULL END
    ], NULL) as match_reasons
  FROM customer_matches cm
  WHERE 
    (
      (p_gst_number IS NOT NULL AND cm.gst_number IS NOT NULL AND UPPER(TRIM(p_gst_number)) = UPPER(TRIM(cm.gst_number)) AND LENGTH(TRIM(p_gst_number)) > 5)
      OR (normalized_phone IS NOT NULL AND cm.normalized_cust_phone IS NOT NULL AND LENGTH(normalized_phone) >= 10 AND normalized_phone = cm.normalized_cust_phone)
      OR (p_email IS NOT NULL AND cm.email IS NOT NULL AND LOWER(TRIM(p_email)) = LOWER(TRIM(cm.email)) AND LENGTH(TRIM(p_email)) > 5)
      OR (p_company_name IS NOT NULL AND cm.company_name IS NOT NULL AND LOWER(TRIM(p_company_name)) = LOWER(TRIM(cm.company_name)))
    )
  ORDER BY match_score DESC
  LIMIT 10;
END;
$function$;