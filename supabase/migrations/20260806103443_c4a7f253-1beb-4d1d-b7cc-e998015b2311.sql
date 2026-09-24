CREATE TABLE public.performance_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID,
  department TEXT NOT NULL DEFAULT 'procurement',
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  direction TEXT NOT NULL DEFAULT 'higher_better',
  warn_tolerance NUMERIC NOT NULL DEFAULT 10,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT performance_benchmarks_direction_chk CHECK (direction IN ('higher_better','lower_better'))
);

CREATE UNIQUE INDEX performance_benchmarks_unique_scope
  ON public.performance_benchmarks (department, metric, COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_benchmarks TO authenticated;
GRANT ALL ON public.performance_benchmarks TO service_role;

ALTER TABLE public.performance_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view benchmarks in their tenant"
  ON public.performance_benchmarks FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Leaders can insert benchmarks"
  ON public.performance_benchmarks FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Leaders can update benchmarks"
  ON public.performance_benchmarks FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Leaders can delete benchmarks"
  ON public.performance_benchmarks FOR DELETE TO authenticated
  USING (public.is_manager_or_above(auth.uid()));

CREATE TRIGGER update_performance_benchmarks_updated_at
  BEFORE UPDATE ON public.performance_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();