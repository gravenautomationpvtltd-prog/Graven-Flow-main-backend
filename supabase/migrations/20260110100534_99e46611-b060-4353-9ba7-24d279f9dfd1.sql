-- Drop the partially created tables and recreate with correct RLS
DROP TABLE IF EXISTS public.pricing_alerts CASCADE;
DROP TABLE IF EXISTS public.pricing_alert_settings CASCADE;
DROP FUNCTION IF EXISTS check_pricing_alerts();

-- Create pricing alerts table
CREATE TABLE public.pricing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_win_rate', 'high_price_gap', 'price_increase', 'price_decrease')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_value DECIMAL(12,2),
  threshold_value DECIMAL(12,2),
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pricing alert settings table for thresholds
CREATE TABLE public.pricing_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default threshold settings
INSERT INTO public.pricing_alert_settings (setting_key, setting_value, description) VALUES
  ('min_win_rate_threshold', 30.00, 'Minimum win rate percentage before triggering alert'),
  ('max_price_gap_threshold', 15.00, 'Maximum price gap percentage before triggering alert'),
  ('significant_price_change', 10.00, 'Percentage change in price to trigger alert');

-- Enable RLS
ALTER TABLE public.pricing_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_alerts using existing role functions
CREATE POLICY "Managers and above can view pricing alerts"
  ON public.pricing_alerts FOR SELECT
  USING (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Managers and above can update pricing alerts"
  ON public.pricing_alerts FOR UPDATE
  USING (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "System can insert pricing alerts"
  ON public.pricing_alerts FOR INSERT
  WITH CHECK (true);

-- RLS policies for pricing_alert_settings
CREATE POLICY "Managers and above can view alert settings"
  ON public.pricing_alert_settings FOR SELECT
  USING (is_manager_or_above(auth.uid()) OR is_procurement_or_above(auth.uid()));

CREATE POLICY "Admins can update alert settings"
  ON public.pricing_alert_settings FOR UPDATE
  USING (is_admin_or_above(auth.uid()));

-- Create indexes
CREATE INDEX idx_pricing_alerts_product ON public.pricing_alerts(product_id);
CREATE INDEX idx_pricing_alerts_type ON public.pricing_alerts(alert_type);
CREATE INDEX idx_pricing_alerts_unread ON public.pricing_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_pricing_alerts_unresolved ON public.pricing_alerts(is_resolved) WHERE is_resolved = false;

-- Create function to check and generate pricing alerts
CREATE OR REPLACE FUNCTION check_pricing_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_win_rate DECIMAL;
  max_price_gap DECIMAL;
  product_record RECORD;
BEGIN
  -- Get threshold settings
  SELECT setting_value INTO min_win_rate FROM pricing_alert_settings WHERE setting_key = 'min_win_rate_threshold';
  SELECT setting_value INTO max_price_gap FROM pricing_alert_settings WHERE setting_key = 'max_price_gap_threshold';
  
  -- Default values if not set
  min_win_rate := COALESCE(min_win_rate, 30);
  max_price_gap := COALESCE(max_price_gap, 15);
  
  -- Check for low win rate products
  FOR product_record IN
    SELECT 
      p.id as product_id,
      p.name as product_name,
      COUNT(CASE WHEN qin.outcome = 'won' THEN 1 END)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100 as win_rate,
      COUNT(*) as total_negotiations
    FROM products p
    LEFT JOIN quotation_item_negotiations qin ON qin.product_id = p.id
    WHERE qin.outcome IS NOT NULL
    GROUP BY p.id, p.name
    HAVING COUNT(*) >= 5
      AND COUNT(CASE WHEN qin.outcome = 'won' THEN 1 END)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100 < min_win_rate
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pricing_alerts 
      WHERE product_id = product_record.product_id 
      AND alert_type = 'low_win_rate' 
      AND is_resolved = false
      AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO pricing_alerts (product_id, alert_type, severity, title, message, metric_value, threshold_value)
      VALUES (
        product_record.product_id,
        'low_win_rate',
        CASE WHEN product_record.win_rate < 15 THEN 'critical' ELSE 'warning' END,
        'Low Win Rate Alert',
        format('%s has a win rate of %.1f%% (below %.1f%% threshold) across %s negotiations',
          product_record.product_name, product_record.win_rate, min_win_rate, product_record.total_negotiations),
        product_record.win_rate,
        min_win_rate
      );
    END IF;
  END LOOP;
  
  -- Check for high price gaps
  FOR product_record IN
    SELECT 
      p.id as product_id,
      p.name as product_name,
      AVG(ABS(qin.price_gap)) as avg_price_gap,
      COUNT(*) as total_negotiations
    FROM products p
    LEFT JOIN quotation_item_negotiations qin ON qin.product_id = p.id
    WHERE qin.price_gap IS NOT NULL
    GROUP BY p.id, p.name
    HAVING COUNT(*) >= 3
      AND AVG(ABS(qin.price_gap)) > max_price_gap
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pricing_alerts 
      WHERE product_id = product_record.product_id 
      AND alert_type = 'high_price_gap' 
      AND is_resolved = false
      AND created_at > now() - interval '7 days'
    ) THEN
      INSERT INTO pricing_alerts (product_id, alert_type, severity, title, message, metric_value, threshold_value)
      VALUES (
        product_record.product_id,
        'high_price_gap',
        CASE WHEN product_record.avg_price_gap > 25 THEN 'critical' ELSE 'warning' END,
        'High Price Gap Detected',
        format('%s has an average price gap of %.1f%% (above %.1f%% threshold)',
          product_record.product_name, product_record.avg_price_gap, max_price_gap),
        product_record.avg_price_gap,
        max_price_gap
      );
    END IF;
  END LOOP;
END;
$$;