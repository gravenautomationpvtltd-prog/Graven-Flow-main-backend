-- 1. Attribution columns on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_created_by_fkey') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by)
      REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_updated_by_fkey') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by)
      REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_updated_by ON public.products(updated_by);

-- 2. Stamp actor automatically
CREATE OR REPLACE FUNCTION public.stamp_product_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
    IF NEW.updated_by IS NULL THEN NEW.updated_by := auth.uid(); END IF;
  ELSE
    IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_product_actor ON public.products;
CREATE TRIGGER trg_stamp_product_actor
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.stamp_product_actor();

-- 3. Backfill from activity_logs
UPDATE public.products p
SET created_by = a.user_id
FROM (
  SELECT DISTINCT ON (entity_id) entity_id, user_id
  FROM public.activity_logs
  WHERE entity_type = 'product' AND action = 'create' AND user_id IS NOT NULL
  ORDER BY entity_id, created_at ASC
) a
WHERE a.entity_id = p.id AND p.created_by IS NULL;

UPDATE public.products p
SET updated_by = a.user_id
FROM (
  SELECT DISTINCT ON (entity_id) entity_id, user_id
  FROM public.activity_logs
  WHERE entity_type = 'product' AND action IN ('create','update') AND user_id IS NOT NULL
  ORDER BY entity_id, created_at DESC
) a
WHERE a.entity_id = p.id AND p.updated_by IS NULL;

UPDATE public.products
SET updated_by = price_updated_by
WHERE updated_by IS NULL AND price_updated_by IS NOT NULL;

-- 4. Product work assignments
CREATE TABLE IF NOT EXISTS public.product_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'verify',
  status text NOT NULL DEFAULT 'assigned',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  note text,
  assigned_to uuid,
  assigned_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_assignments_task_type_check CHECK (task_type IN ('update_pricing','add_details','verify','mark_legacy','remove')),
  CONSTRAINT product_assignments_status_check CHECK (status IN ('assigned','in_progress','completed','blocked')),
  CONSTRAINT product_assignments_priority_check CHECK (priority IN ('low','normal','high','urgent'))
);

CREATE INDEX IF NOT EXISTS idx_product_assignments_assigned_to ON public.product_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_product_assignments_product ON public.product_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assignments_status ON public.product_assignments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_assignments TO authenticated;
GRANT ALL ON public.product_assignments TO service_role;

ALTER TABLE public.product_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BIE can view product assignments" ON public.product_assignments;
CREATE POLICY "BIE can view product assignments"
ON public.product_assignments FOR SELECT TO authenticated
USING (
  public.is_bie_member(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid()))
);

DROP POLICY IF EXISTS "BIE can create product assignments" ON public.product_assignments;
CREATE POLICY "BIE can create product assignments"
ON public.product_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.is_bie_member(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND assigned_by = auth.uid()
);

DROP POLICY IF EXISTS "BIE can update product assignments" ON public.product_assignments;
CREATE POLICY "BIE can update product assignments"
ON public.product_assignments FOR UPDATE TO authenticated
USING (
  public.is_bie_member(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND (assigned_to = auth.uid() OR public.is_bie_manager(auth.uid()))
);

DROP POLICY IF EXISTS "BIE managers can delete product assignments" ON public.product_assignments;
CREATE POLICY "BIE managers can delete product assignments"
ON public.product_assignments FOR DELETE TO authenticated
USING (
  public.is_bie_manager(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

-- 5. Completion stamp
CREATE OR REPLACE FUNCTION public.stamp_product_assignment_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_assignment_completion ON public.product_assignments;
CREATE TRIGGER trg_product_assignment_completion
BEFORE INSERT OR UPDATE ON public.product_assignments
FOR EACH ROW EXECUTE FUNCTION public.stamp_product_assignment_completion();