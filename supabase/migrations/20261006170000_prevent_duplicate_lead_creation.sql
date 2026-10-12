-- Migration: Prevent duplicate lead creation with backend idempotency and advisory locks

-- 1. Add idempotency_key column to public.leads if not exists
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2. Create index for fast idempotency lookup
CREATE INDEX IF NOT EXISTS idx_leads_idempotency_lookup
ON public.leads (tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

-- 3. Create index for recent duplicate detection (tenant, source, lower title, created_at)
CREATE INDEX IF NOT EXISTS idx_leads_recent_duplicate_check
ON public.leads (tenant_id, source, created_at DESC)
WHERE deleted_at IS NULL;

-- 4. Clean up ambiguous pick_next_lqt_user(uuid) overload so default 2-arg function is used
DROP FUNCTION IF EXISTS public.pick_next_lqt_user(uuid);

-- 5. Update create_lead_secure function with idempotency, duplicate protection & advisory lock
CREATE OR REPLACE FUNCTION public.create_lead_secure(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_lead_id uuid;
  v_existing_lead_id uuid;
  v_payload jsonb := COALESCE(payload, '{}'::jsonb);
  v_source_text text;
  v_source public.lead_source;
  v_status_text text;
  v_status public.lead_status;
  v_enq_text text;
  v_enq public.enquiry_status;
  v_title text;
  v_customer_id uuid;
  v_source_reference text;
  v_idempotency_key text;
  v_lock_key bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_tenant_id := NULLIF(v_payload->>'tenant_id', '')::uuid;
  IF v_tenant_id IS NULL THEN
    SELECT tu.tenant_id INTO v_tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = v_user_id AND tu.is_active = true
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'NO_ORGANIZATION';
  END IF;

  -- Extract key fields
  v_title := COALESCE(NULLIF(trim(v_payload->>'title'),''), 'Untitled Lead');
  v_customer_id := NULLIF(v_payload->>'customer_id','')::uuid;
  v_source_reference := NULLIF(trim(v_payload->>'source_reference'),'');
  v_idempotency_key := NULLIF(trim(v_payload->>'idempotency_key'),'');
  v_lead_id := COALESCE(NULLIF(v_payload->>'id','')::uuid, gen_random_uuid());

  -- Safe source cast
  v_source_text := lower(NULLIF(v_payload->>'source',''));
  BEGIN
    IF v_source_text IS NULL THEN
      v_source := 'manual'::public.lead_source;
    ELSE
      v_source := v_source_text::public.lead_source;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_source := 'manual'::public.lead_source;
  END;

  -- -------------------------------------------------------------
  -- CONCURRENCY CONTROL: Transaction-level Advisory Lock
  -- Serializes rapid duplicate clicks from the same user/customer
  -- -------------------------------------------------------------
  v_lock_key := hashtext(v_tenant_id::text || ':' || v_user_id::text || ':' || COALESCE(v_customer_id::text, 'no-cust') || ':' || lower(v_title));
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- -------------------------------------------------------------
  -- CHECK 1: Idempotency Key Match
  -- If client sent an idempotency key, reuse existing lead
  -- -------------------------------------------------------------
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_lead_id
    FROM public.leads
    WHERE tenant_id = v_tenant_id
      AND idempotency_key = v_idempotency_key
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_lead_id IS NOT NULL THEN
      RETURN v_existing_lead_id;
    END IF;
  END IF;

  -- -------------------------------------------------------------
  -- CHECK 2: Same explicit ID already exists
  -- -------------------------------------------------------------
  IF v_payload->>'id' IS NOT NULL AND NULLIF(v_payload->>'id','') IS NOT NULL THEN
    SELECT id INTO v_existing_lead_id
    FROM public.leads
    WHERE id = (v_payload->>'id')::uuid
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_lead_id IS NOT NULL THEN
      RETURN v_existing_lead_id;
    END IF;
  END IF;

  -- -------------------------------------------------------------
  -- CHECK 3: Identical Lead created recently (within last 60 seconds)
  -- Matches same tenant, source, customer, title, and source_reference
  -- -------------------------------------------------------------
  SELECT id INTO v_existing_lead_id
  FROM public.leads
  WHERE tenant_id = v_tenant_id
    AND source = v_source
    AND lower(trim(title)) = lower(v_title)
    AND (
      (customer_id IS NULL AND v_customer_id IS NULL)
      OR customer_id = v_customer_id
    )
    AND (
      (source_reference IS NULL AND v_source_reference IS NULL)
      OR source_reference = v_source_reference
    )
    AND deleted_at IS NULL
    AND created_at >= (NOW() - INTERVAL '60 seconds')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    RETURN v_existing_lead_id;
  END IF;

  -- Safe status cast
  v_status_text := lower(NULLIF(v_payload->>'status',''));
  BEGIN
    IF v_status_text IS NULL THEN
      v_status := 'new'::public.lead_status;
    ELSE
      v_status := v_status_text::public.lead_status;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_status := 'new'::public.lead_status;
  END;

  -- Safe enquiry_status cast (nullable)
  v_enq_text := lower(NULLIF(v_payload->>'enquiry_status',''));
  BEGIN
    IF v_enq_text IS NULL THEN
      v_enq := NULL;
    ELSE
      v_enq := v_enq_text::public.enquiry_status;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_enq := NULL;
  END;

  INSERT INTO public.leads (
    id,
    tenant_id,
    title,
    customer_id,
    customer_query,
    source,
    source_reference,
    status,
    enquiry_status,
    has_enquiry,
    assigned_to,
    office_id,
    estimated_value,
    expected_close_date,
    suggested_assignee_id,
    idempotency_key
  )
  VALUES (
    v_lead_id,
    v_tenant_id,
    v_title,
    v_customer_id,
    NULLIF(v_payload->>'customer_query',''),
    v_source,
    v_source_reference,
    v_status,
    v_enq,
    COALESCE((v_payload->>'has_enquiry')::boolean, false),
    NULLIF(v_payload->>'assigned_to','')::uuid,
    NULLIF(v_payload->>'office_id','')::uuid,
    NULLIF(v_payload->>'estimated_value','')::numeric,
    NULLIF(v_payload->>'expected_close_date','')::date,
    NULLIF(v_payload->>'suggested_assignee_id','')::uuid,
    v_idempotency_key
  );

  RETURN v_lead_id;
END;
$function$;
