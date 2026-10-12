-- Migration: 20260901000000_lqt_tst_feedback_workflow.sql
-- Description: Complete LQT -> Customer Form -> Payment Structure -> TST -> Customer Feedback Workflow
-- Live Production Safe, Additive Migration

-- 1. CUSTOMER FORMS TABLE
CREATE TABLE IF NOT EXISTS public.customer_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('not_sent', 'sent', 'opened', 'in_progress', 'submitted', 'expired')),
  prefilled_data JSONB DEFAULT '{}'::jsonb,
  submitted_data JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PAYMENT REQUESTS TABLE (Modular, ready for Razorpay)
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  purpose TEXT NOT NULL DEFAULT 'Technical Consultation / TST Service',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('not_requested', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_reference TEXT,
  payment_link TEXT,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  is_test_mode BOOLEAN NOT NULL DEFAULT true,
  paid_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TST CASES TABLE
CREATE TABLE IF NOT EXISTS public.tst_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  customer_form_id UUID REFERENCES public.customer_forms(id) ON DELETE SET NULL,
  qualification_id UUID REFERENCES public.lead_qualification(id) ON DELETE SET NULL,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'follow_up', 'resolved', 'escalated', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT,
  description TEXT,
  escalation_reason TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TST INTERACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.tst_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tst_case_id UUID REFERENCES public.tst_cases(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  employee_id UUID,
  call_status TEXT NOT NULL CHECK (call_status IN ('connected', 'not_connected', 'busy', 'callback_required', 'wrong_number')),
  customer_requirement TEXT,
  problem_issue TEXT,
  solution_provided TEXT,
  product_solution_suggested TEXT,
  customer_response TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'partially_resolved' CHECK (resolution_status IN ('resolved', 'partially_resolved', 'not_resolved')),
  follow_up_required BOOLEAN NOT NULL DEFAULT false,
  follow_up_date TIMESTAMPTZ,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TST FOLLOW-UPS TABLE
CREATE TABLE IF NOT EXISTS public.tst_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tst_case_id UUID REFERENCES public.tst_cases(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES public.tst_interactions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to UUID,
  follow_up_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CUSTOMER FEEDBACK & TOKENS
CREATE TABLE IF NOT EXISTS public.feedback_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  tst_case_id UUID REFERENCES public.tst_cases(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  interaction_id UUID REFERENCES public.tst_interactions(id) ON DELETE SET NULL,
  employee_id UUID,
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  feedback_token_id UUID REFERENCES public.feedback_tokens(id) ON DELETE SET NULL,
  tst_case_id UUID REFERENCES public.tst_cases(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  interaction_id UUID REFERENCES public.tst_interactions(id) ON DELETE SET NULL,
  employee_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  requirement_resolved TEXT NOT NULL CHECK (requirement_resolved IN ('yes', 'partially', 'no')),
  team_rating TEXT NOT NULL CHECK (team_rating IN ('excellent', 'good', 'average', 'poor')),
  liked_aspects TEXT,
  improvement_areas TEXT,
  comments TEXT,
  low_rating_reasons TEXT[] DEFAULT '{}',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_forms_token ON public.customer_forms(token);
CREATE INDEX IF NOT EXISTS idx_customer_forms_lead ON public.customer_forms(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_lead ON public.payment_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_tst_cases_customer ON public.tst_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_tst_cases_lead ON public.tst_cases(lead_id);
CREATE INDEX IF NOT EXISTS idx_tst_cases_status ON public.tst_cases(status);
CREATE INDEX IF NOT EXISTS idx_tst_cases_assigned ON public.tst_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tst_interactions_case ON public.tst_interactions(tst_case_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tokens_token ON public.feedback_tokens(token);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_case ON public.customer_feedback(tst_case_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_employee ON public.customer_feedback(employee_id);

-- Enable RLS
ALTER TABLE public.customer_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tst_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tst_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tst_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Authenticated Staff
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_customer_forms' AND tablename = 'customer_forms') THEN
    CREATE POLICY staff_customer_forms ON public.customer_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_payment_requests' AND tablename = 'payment_requests') THEN
    CREATE POLICY staff_payment_requests ON public.payment_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_tst_cases' AND tablename = 'tst_cases') THEN
    CREATE POLICY staff_tst_cases ON public.tst_cases FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_tst_interactions' AND tablename = 'tst_interactions') THEN
    CREATE POLICY staff_tst_interactions ON public.tst_interactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_tst_followups' AND tablename = 'tst_followups') THEN
    CREATE POLICY staff_tst_followups ON public.tst_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_feedback_tokens' AND tablename = 'feedback_tokens') THEN
    CREATE POLICY staff_feedback_tokens ON public.feedback_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_customer_feedback' AND tablename = 'customer_feedback') THEN
    CREATE POLICY staff_customer_feedback ON public.customer_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for Public Access (Anonymously view & submit customer forms and feedback via valid tokens)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_view_customer_form' AND tablename = 'customer_forms') THEN
    CREATE POLICY anon_view_customer_form ON public.customer_forms FOR SELECT TO anon USING (token IS NOT NULL AND expires_at > now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_customer_form' AND tablename = 'customer_forms') THEN
    CREATE POLICY anon_update_customer_form ON public.customer_forms FOR UPDATE TO anon USING (token IS NOT NULL AND expires_at > now()) WITH CHECK (token IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_view_feedback_token' AND tablename = 'feedback_tokens') THEN
    CREATE POLICY anon_view_feedback_token ON public.feedback_tokens FOR SELECT TO anon USING (token IS NOT NULL AND is_used = false AND expires_at > now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_feedback_token' AND tablename = 'feedback_tokens') THEN
    CREATE POLICY anon_update_feedback_token ON public.feedback_tokens FOR UPDATE TO anon USING (token IS NOT NULL) WITH CHECK (token IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_customer_feedback' AND tablename = 'customer_feedback') THEN
    CREATE POLICY anon_insert_customer_feedback ON public.customer_feedback FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions to anon and authenticated
GRANT SELECT, INSERT, UPDATE ON public.customer_forms TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tst_cases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tst_interactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tst_followups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.feedback_tokens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_feedback TO anon, authenticated, service_role;

-- Automated trigger: when payment_requests status changes to 'paid', auto-create a TST case if one doesn't exist
CREATE OR REPLACE FUNCTION public.handle_payment_paid_tst_case()
RETURNS TRIGGER AS $$
DECLARE
  _lqt_qual RECORD;
  _case_id UUID;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    SELECT id INTO _case_id FROM public.tst_cases WHERE payment_request_id = NEW.id LIMIT 1;
    
    IF _case_id IS NULL THEN
      SELECT id, qualified_by INTO _lqt_qual FROM public.lead_qualification WHERE lead_id = NEW.lead_id LIMIT 1;
      
      INSERT INTO public.tst_cases (
        tenant_id,
        customer_id,
        lead_id,
        payment_request_id,
        qualification_id,
        status,
        priority,
        title,
        description,
        created_by
      ) VALUES (
        NEW.tenant_id,
        NEW.customer_id,
        NEW.lead_id,
        NEW.id,
        _lqt_qual.id,
        'new',
        'medium',
        COALESCE(NEW.purpose, 'Paid TST Support Case'),
        NEW.description,
        NEW.created_by
      ) RETURNING id INTO _case_id;

      -- Update lead status to qualified if it was new or contacted
      UPDATE public.leads 
      SET status = 'qualified', updated_at = now() 
      WHERE id = NEW.lead_id AND status IN ('new', 'contacted');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_paid_tst_case ON public.payment_requests;
CREATE TRIGGER trg_payment_paid_tst_case
  AFTER UPDATE OR INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_paid_tst_case();
