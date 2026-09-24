-- =============================================
-- 1. SCHEDULED REPORTS TABLE
-- =============================================
CREATE TABLE public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'leads', 'orders', 'invoices', 'customers', 'inventory'
  filters JSONB DEFAULT '{}',
  schedule TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  recipients TEXT[] NOT NULL,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_reports
CREATE POLICY "Users can view their own scheduled reports"
ON public.scheduled_reports FOR SELECT
USING (created_by = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "Users can create their own scheduled reports"
ON public.scheduled_reports FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own scheduled reports"
ON public.scheduled_reports FOR UPDATE
USING (created_by = auth.uid() OR is_admin_or_above(auth.uid()));

CREATE POLICY "Users can delete their own scheduled reports"
ON public.scheduled_reports FOR DELETE
USING (created_by = auth.uid() OR is_admin_or_above(auth.uid()));

-- =============================================
-- 2. REMINDERS TABLE
-- =============================================
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  entity_type TEXT NOT NULL, -- 'lead', 'task', 'customer', 'order'
  entity_id UUID NOT NULL,
  entity_name TEXT, -- For display purposes
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  remind_before_minutes INTEGER DEFAULT 30,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Users can view their own reminders"
ON public.reminders FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reminders"
ON public.reminders FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reminders"
ON public.reminders FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reminders"
ON public.reminders FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;

-- Indexes for performance
CREATE INDEX idx_reminders_user_due ON public.reminders(user_id, due_at);
CREATE INDEX idx_reminders_entity ON public.reminders(entity_type, entity_id);

-- =============================================
-- 3. ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'export', 'login', 'logout'
  entity_type TEXT NOT NULL, -- 'lead', 'customer', 'order', 'invoice', etc.
  entity_id UUID,
  entity_name TEXT, -- For display purposes
  changes JSONB, -- Store before/after for updates
  metadata JSONB DEFAULT '{}', -- Additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs (admin only for viewing)
CREATE POLICY "Only admins can view activity logs"
ON public.activity_logs FOR SELECT
USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Authenticated users can create activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- No update or delete allowed for audit integrity

-- Indexes for efficient querying
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE TRIGGER update_scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();