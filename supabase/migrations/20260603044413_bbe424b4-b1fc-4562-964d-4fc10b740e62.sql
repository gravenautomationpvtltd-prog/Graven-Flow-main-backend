DO $$
DECLARE
  v_aditi   uuid := 'a5786ad0-a2f9-4deb-a2f7-d2fd27b79e78';
  v_swarna  uuid := '0fcbe4e7-add5-4190-8dec-03448caba162';
  v_purti   uuid := '12e9b819-2649-431d-ae95-9afe9a1e48c6';
  v_jyoti   uuid := 'b9e6a74e-659a-429d-b7a2-f3f34eb600a1';
  v_gourav  uuid := '1b31352d-50d2-4eca-910d-927f0eb9cb8e';
  v_anuj    uuid := 'ccd32ff1-258c-45e7-801f-88b7e263fa3d';
  v_moved   int := 0;
  v_orphans int := 0;
BEGIN
  CREATE TEMP TABLE _spt_active(user_id uuid PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _spt_active VALUES (v_aditi),(v_swarna),(v_purti),(v_jyoti),(v_gourav),(v_anuj);

  CREATE TEMP TABLE _rr_pool(idx int PRIMARY KEY, user_id uuid) ON COMMIT DROP;
  INSERT INTO _rr_pool VALUES (0, v_aditi),(1, v_swarna),(2, v_purti),(3, v_jyoti);

  CREATE TEMP TABLE _loyal AS
  WITH hist AS (
    SELECT cah.customer_id, cah.assigned_to AS uid, cah.assigned_from AS ts,
           row_number() OVER (PARTITION BY cah.customer_id ORDER BY cah.assigned_from ASC, cah.created_at ASC) rn
    FROM customer_assignment_history cah
    JOIN _spt_active s ON s.user_id = cah.assigned_to
  ),
  ld AS (
    SELECT l.customer_id, l.assigned_to AS uid, l.created_at AS ts,
           row_number() OVER (PARTITION BY l.customer_id ORDER BY l.created_at ASC) rn
    FROM leads l
    JOIN _spt_active s ON s.user_id = l.assigned_to
    WHERE l.deleted_at IS NULL
  ),
  q AS (
    SELECT qq.customer_id, qq.created_by AS uid, qq.created_at AS ts,
           row_number() OVER (PARTITION BY qq.customer_id ORDER BY qq.created_at ASC) rn
    FROM quotations qq
    JOIN _spt_active s ON s.user_id = qq.created_by
    WHERE qq.deleted_at IS NULL
  ),
  so AS (
    SELECT s2.customer_id, s2.created_by AS uid, s2.created_at AS ts,
           row_number() OVER (PARTITION BY s2.customer_id ORDER BY s2.created_at ASC) rn
    FROM sales_orders s2
    JOIN _spt_active s ON s.user_id = s2.created_by
  ),
  combined AS (
    SELECT customer_id, uid, ts, 1 AS prio FROM hist WHERE rn=1
    UNION ALL SELECT customer_id, uid, ts, 2 FROM ld WHERE rn=1
    UNION ALL SELECT customer_id, uid, ts, 3 FROM q  WHERE rn=1
    UNION ALL SELECT customer_id, uid, ts, 4 FROM so WHERE rn=1
  ),
  ranked AS (
    SELECT customer_id, uid, ts, prio,
           row_number() OVER (PARTITION BY customer_id ORDER BY prio ASC, ts ASC) rn
    FROM combined
  )
  SELECT customer_id, uid AS loyal_owner FROM ranked WHERE rn = 1;

  CREATE INDEX ON _loyal(customer_id);

  CREATE TEMP TABLE _orphans AS
  SELECT c.id AS customer_id,
         (row_number() OVER (ORDER BY c.created_at ASC, c.id ASC) - 1) AS seq
  FROM customers c
  LEFT JOIN _loyal l ON l.customer_id = c.id
  WHERE c.deleted_at IS NULL AND l.customer_id IS NULL;

  CREATE TEMP TABLE _targets AS
  SELECT c.id AS customer_id,
         c.assigned_sales_id AS current_owner,
         c.tenant_id,
         COALESCE(
           l.loyal_owner,
           (SELECT user_id FROM _rr_pool WHERE idx = (o.seq % 4))
         ) AS new_owner
  FROM customers c
  LEFT JOIN _loyal l   ON l.customer_id = c.id
  LEFT JOIN _orphans o ON o.customer_id = c.id
  WHERE c.deleted_at IS NULL;

  CREATE INDEX ON _targets(customer_id);

  SELECT count(*) INTO v_orphans FROM _orphans;
  SELECT count(*) INTO v_moved   FROM _targets WHERE current_owner IS DISTINCT FROM new_owner;
  RAISE NOTICE 'Loyalty reassignment: % customers will move (% true orphans round-robin)', v_moved, v_orphans;

  ALTER TABLE public.customers DISABLE TRIGGER customers_protect_loyal_owner;

  UPDATE customer_assignment_history cah
  SET assigned_until = now()
  FROM _targets t
  WHERE cah.customer_id = t.customer_id
    AND cah.assigned_until IS NULL
    AND t.current_owner IS DISTINCT FROM t.new_owner;

  INSERT INTO customer_assignment_history(customer_id, assigned_to, assigned_from, tenant_id)
  SELECT t.customer_id, t.new_owner, now(), t.tenant_id
  FROM _targets t
  WHERE t.current_owner IS DISTINCT FROM t.new_owner
    AND t.new_owner IS NOT NULL;

  UPDATE customers c
  SET assigned_sales_id = t.new_owner,
      updated_at = now()
  FROM _targets t
  WHERE c.id = t.customer_id
    AND c.assigned_sales_id IS DISTINCT FROM t.new_owner
    AND t.new_owner IS NOT NULL;

  UPDATE leads l
  SET assigned_to = t.new_owner,
      updated_at = now()
  FROM _targets t
  WHERE l.customer_id = t.customer_id
    AND l.deleted_at IS NULL
    AND l.status NOT IN ('won','lost')
    AND l.assigned_to IS DISTINCT FROM t.new_owner
    AND t.new_owner IS NOT NULL;

  UPDATE quotations q
  SET created_by = t.new_owner,
      updated_at = now()
  FROM _targets t
  WHERE q.customer_id = t.customer_id
    AND q.deleted_at IS NULL
    AND q.created_by IS DISTINCT FROM t.new_owner
    AND t.new_owner IS NOT NULL;

  UPDATE sales_orders so
  SET created_by = t.new_owner,
      updated_at = now()
  FROM _targets t
  WHERE so.customer_id = t.customer_id
    AND so.created_by IS DISTINCT FROM t.new_owner
    AND t.new_owner IS NOT NULL;

  ALTER TABLE public.customers ENABLE TRIGGER customers_protect_loyal_owner;

  RAISE NOTICE 'Loyalty reassignment complete.';
END $$;