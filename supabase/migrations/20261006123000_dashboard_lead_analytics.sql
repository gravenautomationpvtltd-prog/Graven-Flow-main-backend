-- Migration: Fast server-side dashboard lead analytics + FK index
-- Eliminates statement timeouts and missing chart data on sales dashboard

CREATE INDEX IF NOT EXISTS idx_price_requests_lead_id_assignees 
ON public.price_requests (lead_id, assigned_to, requested_by);

CREATE INDEX IF NOT EXISTS idx_leads_analytics_perf 
ON public.leads (tenant_id, assigned_to, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_dashboard_lead_analytics(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_vertical_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_tenant_id uuid;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_effective_assigned_to uuid := p_assigned_to;
  v_from timestamptz;
  v_to timestamptz;
  v_trends jsonb := '[]'::jsonb;
  v_pipeline jsonb := '[]'::jsonb;
  v_sources jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('leadTrends', '[]'::jsonb, 'salesPipeline', '[]'::jsonb, 'leadSources', '[]'::jsonb);
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user;
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '1a5184ef-5138-4327-8928-67bc4f229131'::uuid;
  END IF;

  v_is_admin := public.is_admin_or_above(v_user);
  v_is_manager := public.is_manager_or_above(v_user);

  -- If standard rep (non-admin, non-manager), always enforce self-scoping
  IF NOT (v_is_admin OR v_is_manager) THEN
    v_effective_assigned_to := v_user;
  END IF;

  -- 6 months window default
  v_from := COALESCE(p_from, date_trunc('month', now() - interval '5 months'));
  v_to := COALESCE(p_to, now());

  -- 1. Monthly Trends (last 6 months buckets)
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', v_from),
      date_trunc('month', v_to),
      interval '1 month'
    ) AS m
  ),
  aggregated AS (
    SELECT 
      date_trunc('month', l.created_at) AS m,
      count(*)::int AS total_leads,
      count(*) FILTER (WHERE l.source = 'indiamart')::int AS indiamart,
      count(*) FILTER (WHERE l.source = 'tradeindia')::int AS tradeindia,
      count(*) FILTER (WHERE l.source = 'manual')::int AS manual,
      count(*) FILTER (WHERE l.source NOT IN ('indiamart', 'tradeindia', 'manual'))::int AS other
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (v_effective_assigned_to IS NULL OR l.assigned_to = v_effective_assigned_to)
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', to_char(months.m, 'Mon'),
      'leads', COALESCE(agg.total_leads, 0),
      'indiamart', COALESCE(agg.indiamart, 0),
      'tradeindia', COALESCE(agg.tradeindia, 0),
      'manual', COALESCE(agg.manual, 0),
      'other', COALESCE(agg.other, 0)
    ) ORDER BY months.m
  ) INTO v_trends
  FROM months
  LEFT JOIN aggregated agg ON agg.m = months.m;

  -- 2. Sales Pipeline
  WITH pipe_agg AS (
    SELECT 
      l.status,
      count(*)::int AS count
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (v_effective_assigned_to IS NULL OR l.assigned_to = v_effective_assigned_to)
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY l.status
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'status', status,
      'count', count,
      'label', initcap(replace(status::text, '_', ' ')),
      'color', CASE status::text
        WHEN 'new' THEN 'hsl(var(--chart-1))'
        WHEN 'contacted' THEN 'hsl(var(--chart-2))'
        WHEN 'engaged' THEN 'hsl(var(--chart-3))'
        WHEN 'quoted' THEN 'hsl(var(--chart-4))'
        WHEN 'negotiation' THEN 'hsl(var(--chart-5))'
        WHEN 'won' THEN 'hsl(var(--success))'
        WHEN 'lost' THEN 'hsl(var(--destructive))'
        ELSE 'hsl(var(--muted))'
      END
    ) ORDER BY count DESC
  ) INTO v_pipeline
  FROM pipe_agg;

  -- 3. Lead Sources
  WITH src_agg AS (
    SELECT 
      l.source,
      count(*)::int AS count
    FROM public.leads l
    WHERE l.tenant_id = v_tenant_id
      AND l.deleted_at IS NULL
      AND l.created_at >= v_from
      AND l.created_at <= v_to
      AND (v_effective_assigned_to IS NULL OR l.assigned_to = v_effective_assigned_to)
      AND (p_vertical_id IS NULL OR l.vertical_id = p_vertical_id)
    GROUP BY l.source
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'source', source,
      'count', count,
      'label', CASE source::text
        WHEN 'indiamart' THEN 'IndiaMART'
        WHEN 'tradeindia' THEN 'TradeIndia'
        WHEN 'whatsapp' THEN 'WhatsApp'
        WHEN 'manual' THEN 'Manual'
        WHEN 'website' THEN 'Website'
        ELSE initcap(source::text)
      END,
      'fill', CASE source::text
        WHEN 'indiamart' THEN 'hsl(var(--chart-1))'
        WHEN 'tradeindia' THEN 'hsl(var(--chart-2))'
        WHEN 'whatsapp' THEN 'hsl(var(--chart-4))'
        WHEN 'manual' THEN 'hsl(var(--primary))'
        WHEN 'website' THEN 'hsl(var(--chart-5))'
        ELSE 'hsl(var(--muted))'
      END
    ) ORDER BY count DESC
  ) INTO v_sources
  FROM src_agg;

  RETURN jsonb_build_object(
    'leadTrends', COALESCE(v_trends, '[]'::jsonb),
    'salesPipeline', COALESCE(v_pipeline, '[]'::jsonb),
    'leadSources', COALESCE(v_sources, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_lead_analytics(timestamptz, timestamptz, uuid, uuid) TO authenticated;
