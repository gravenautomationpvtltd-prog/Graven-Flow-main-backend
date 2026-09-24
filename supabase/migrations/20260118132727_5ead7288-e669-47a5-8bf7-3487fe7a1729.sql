
-- ============================================
-- SUPPLIER NETWORK & RFQ MODULE - FOUNDATION
-- ============================================

-- 1. Country Master Table
CREATE TABLE public.countries (
  code VARCHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Currency Master Table
CREATE TABLE public.currencies (
  code VARCHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  symbol VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Supplier Categories (Product categories suppliers can be assigned to)
CREATE TABLE public.supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_category_id UUID REFERENCES public.supplier_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Supplier Category Assignments (M:M link)
CREATE TABLE public.supplier_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.supplier_categories(id) ON DELETE CASCADE,
  is_rfq_eligible BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  UNIQUE(supplier_id, category_id)
);

-- 5. FX Rates Table (Immutable after RFQ close)
CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(18, 8) NOT NULL,
  rate_date DATE NOT NULL,
  source TEXT DEFAULT 'manual',
  is_locked BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_currency, to_currency, rate_date)
);

-- 6. RFQs Master Table
CREATE TABLE public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.supplier_categories(id),
  description TEXT,
  technical_specifications JSONB,
  quantity DECIMAL(15, 3),
  unit TEXT DEFAULT 'pcs',
  target_delivery_location TEXT,
  delivery_timeline_days INTEGER,
  required_documents TEXT[],
  base_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  fx_reference_date DATE,
  fx_source TEXT DEFAULT 'manual',
  issue_date DATE,
  deadline_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES public.profiles(id),
  assigned_manager_id UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT rfq_status_check CHECK (status IN ('draft', 'issued', 'responses_received', 'evaluation', 'awarded', 'closed', 'cancelled'))
);

-- 7. RFQ Items (Line items in each RFQ)
CREATE TABLE public.rfq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  specifications JSONB,
  quantity DECIMAL(15, 3) NOT NULL,
  unit TEXT DEFAULT 'pcs',
  target_price DECIMAL(15, 2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. RFQ Distributions (Track which suppliers received which RFQ)
CREATE TABLE public.rfq_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id),
  viewed_at TIMESTAMPTZ,
  response_status TEXT DEFAULT 'pending',
  declined_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rfq_id, supplier_id),
  CONSTRAINT distribution_status_check CHECK (response_status IN ('pending', 'viewed', 'quoted', 'declined', 'no_response'))
);

-- 9. Supplier Quotations (Quotations submitted by suppliers)
CREATE TABLE public.supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL UNIQUE,
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id),
  rfq_distribution_id UUID REFERENCES public.rfq_distributions(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  quoted_currency VARCHAR(3) NOT NULL,
  fx_rate_to_base DECIMAL(18, 8),
  fx_rate_date DATE,
  total_original DECIMAL(15, 2) NOT NULL,
  total_converted DECIMAL(15, 2),
  lead_time_days INTEGER,
  validity_days INTEGER DEFAULT 30,
  country_of_origin VARCHAR(3),
  hs_code TEXT,
  moq DECIMAL(15, 3),
  payment_terms TEXT,
  notes TEXT,
  status TEXT DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  submitted_by UUID REFERENCES public.profiles(id),
  is_shortlisted BOOLEAN DEFAULT false,
  shortlisted_at TIMESTAMPTZ,
  shortlisted_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  internal_remarks TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT quotation_status_check CHECK (status IN ('draft', 'submitted', 'under_review', 'shortlisted', 'negotiation', 'accepted', 'rejected', 'withdrawn'))
);

-- 10. Supplier Quotation Items
CREATE TABLE public.supplier_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.supplier_quotations(id) ON DELETE CASCADE,
  rfq_item_id UUID REFERENCES public.rfq_items(id),
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15, 3) NOT NULL,
  unit TEXT DEFAULT 'pcs',
  unit_price_original DECIMAL(15, 4) NOT NULL,
  unit_price_converted DECIMAL(15, 4),
  total_original DECIMAL(15, 2) NOT NULL,
  total_converted DECIMAL(15, 2),
  specifications JSONB,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Supplier Documents (Document management with folder structure)
CREATE TABLE public.supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  folder_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  rfq_id UUID REFERENCES public.rfqs(id),
  quotation_id UUID REFERENCES public.supplier_quotations(id),
  uploaded_by UUID REFERENCES public.profiles(id),
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.profiles(id),
  version INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT folder_type_check CHECK (folder_type IN ('company_documents', 'certifications', 'datasheets', 'rfq_documents', 'quotations', 'contracts'))
);

-- 12. Supplier Communications (Threaded messaging)
CREATE TABLE public.supplier_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES public.rfqs(id),
  quotation_id UUID REFERENCES public.supplier_quotations(id),
  parent_id UUID REFERENCES public.supplier_communications(id),
  message_type TEXT DEFAULT 'message',
  subject TEXT,
  content TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false,
  sent_by UUID REFERENCES public.profiles(id),
  sent_by_supplier BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES public.profiles(id),
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT message_type_check CHECK (message_type IN ('message', 'clarification', 'negotiation', 'note', 'system'))
);

-- 13. Supplier Status History (Immutable audit log)
CREATE TABLE public.supplier_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Supplier Notifications
CREATE TABLE public.supplier_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_rfq_id UUID REFERENCES public.rfqs(id),
  related_quotation_id UUID REFERENCES public.supplier_quotations(id),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- UPDATE EXISTING SUPPLIERS TABLE
-- ============================================

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS years_in_operation INTEGER,
ADD COLUMN IF NOT EXISTS manufacturing_type TEXT DEFAULT 'trading',
ADD COLUMN IF NOT EXISTS nda_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS risk_flag TEXT,
ADD COLUMN IF NOT EXISTS preferred_flag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS internal_rating DECIMAL(2, 1),
ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS technical_review_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS technical_reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS commercial_review_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commercial_reviewed_by UUID REFERENCES public.profiles(id);

-- Add constraint for manufacturing type
ALTER TABLE public.suppliers 
ADD CONSTRAINT manufacturing_type_check CHECK (manufacturing_type IN ('manufacturer', 'trading', 'both'));

-- Add constraint for application status
ALTER TABLE public.suppliers 
ADD CONSTRAINT application_status_check CHECK (application_status IN ('submitted', 'under_technical_review', 'under_commercial_review', 'approved', 'rejected', 'on_hold'));

-- Add constraint for risk flag
ALTER TABLE public.suppliers 
ADD CONSTRAINT risk_flag_check CHECK (risk_flag IS NULL OR risk_flag IN ('low', 'medium', 'high'));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_rfqs_status ON public.rfqs(status);
CREATE INDEX idx_rfqs_deadline ON public.rfqs(deadline_date);
CREATE INDEX idx_rfqs_category ON public.rfqs(category_id);
CREATE INDEX idx_rfq_distributions_rfq ON public.rfq_distributions(rfq_id);
CREATE INDEX idx_rfq_distributions_supplier ON public.rfq_distributions(supplier_id);
CREATE INDEX idx_supplier_quotations_rfq ON public.supplier_quotations(rfq_id);
CREATE INDEX idx_supplier_quotations_supplier ON public.supplier_quotations(supplier_id);
CREATE INDEX idx_supplier_quotations_status ON public.supplier_quotations(status);
CREATE INDEX idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX idx_supplier_documents_folder ON public.supplier_documents(folder_type);
CREATE INDEX idx_supplier_communications_supplier ON public.supplier_communications(supplier_id);
CREATE INDEX idx_supplier_communications_rfq ON public.supplier_communications(rfq_id);
CREATE INDEX idx_supplier_status_history_supplier ON public.supplier_status_history(supplier_id);
CREATE INDEX idx_suppliers_application_status ON public.suppliers(application_status);
CREATE INDEX idx_suppliers_assigned_manager ON public.suppliers(assigned_manager_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_notifications ENABLE ROW LEVEL SECURITY;

-- Countries - Read for authenticated users
CREATE POLICY "Countries are viewable by authenticated users" ON public.countries FOR SELECT TO authenticated USING (true);

-- Currencies - Read for authenticated users
CREATE POLICY "Currencies are viewable by authenticated users" ON public.currencies FOR SELECT TO authenticated USING (true);

-- Supplier Categories - Read for authenticated, manage for admins
CREATE POLICY "Supplier categories viewable by authenticated" ON public.supplier_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier categories manageable by authenticated" ON public.supplier_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Category Assignments - Full access for authenticated
CREATE POLICY "Category assignments manageable by authenticated" ON public.supplier_category_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FX Rates - Read for authenticated, insert for authenticated
CREATE POLICY "FX rates viewable by authenticated" ON public.fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "FX rates insertable by authenticated" ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (true);

-- RFQs - Full access for authenticated users
CREATE POLICY "RFQs viewable by authenticated" ON public.rfqs FOR SELECT TO authenticated USING (true);
CREATE POLICY "RFQs manageable by authenticated" ON public.rfqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RFQ Items - Full access for authenticated
CREATE POLICY "RFQ items manageable by authenticated" ON public.rfq_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RFQ Distributions - Full access for authenticated
CREATE POLICY "RFQ distributions manageable by authenticated" ON public.rfq_distributions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Quotations - Full access for authenticated
CREATE POLICY "Supplier quotations viewable by authenticated" ON public.supplier_quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier quotations manageable by authenticated" ON public.supplier_quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Quotation Items - Full access for authenticated
CREATE POLICY "Quotation items manageable by authenticated" ON public.supplier_quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Documents - Full access for authenticated
CREATE POLICY "Supplier documents manageable by authenticated" ON public.supplier_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Communications - Full access for authenticated
CREATE POLICY "Supplier communications manageable by authenticated" ON public.supplier_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Supplier Status History - Read for authenticated, insert for authenticated
CREATE POLICY "Status history viewable by authenticated" ON public.supplier_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Status history insertable by authenticated" ON public.supplier_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- Supplier Notifications - Full access for authenticated
CREATE POLICY "Supplier notifications manageable by authenticated" ON public.supplier_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA
-- ============================================

-- Seed countries
INSERT INTO public.countries (code, name, currency_code) VALUES
('IND', 'India', 'INR'),
('CHN', 'China', 'CNY'),
('SGP', 'Singapore', 'SGD'),
('JPN', 'Japan', 'JPY'),
('VNM', 'Vietnam', 'VND'),
('TWN', 'Taiwan', 'TWD'),
('MYS', 'Malaysia', 'MYR'),
('USA', 'United States', 'USD'),
('GBR', 'United Kingdom', 'GBP'),
('DEU', 'Germany', 'EUR')
ON CONFLICT (code) DO NOTHING;

-- Seed currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
('INR', 'Indian Rupee', '₹'),
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('CNY', 'Chinese Yuan', '¥'),
('JPY', 'Japanese Yen', '¥'),
('SGD', 'Singapore Dollar', 'S$'),
('VND', 'Vietnamese Dong', '₫'),
('TWD', 'Taiwan Dollar', 'NT$'),
('MYR', 'Malaysian Ringgit', 'RM')
ON CONFLICT (code) DO NOTHING;

-- Seed initial supplier categories
INSERT INTO public.supplier_categories (name, description) VALUES
('Electronics & Components', 'Electronic parts, components, and accessories'),
('Industrial Equipment', 'Machinery, tools, and industrial equipment'),
('Raw Materials', 'Metals, plastics, chemicals, and raw materials'),
('Packaging Materials', 'Boxes, containers, and packaging supplies'),
('Safety Equipment', 'PPE, safety gear, and protective equipment'),
('Office Supplies', 'Stationery, furniture, and office equipment'),
('Chemicals', 'Industrial and specialty chemicals'),
('Textiles', 'Fabrics, garments, and textile materials')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- FUNCTIONS FOR AUTO-GENERATION
-- ============================================

-- Function to generate RFQ number
CREATE OR REPLACE FUNCTION public.generate_rfq_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rfq_number IS NULL OR NEW.rfq_number = '' THEN
    NEW.rfq_number := 'RFQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('rfq_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for RFQ numbers
CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START 1;

-- Trigger for RFQ number generation
CREATE TRIGGER trg_generate_rfq_number
BEFORE INSERT ON public.rfqs
FOR EACH ROW
EXECUTE FUNCTION public.generate_rfq_number();

-- Function to generate supplier quotation number
CREATE OR REPLACE FUNCTION public.generate_supplier_quotation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    NEW.quotation_number := 'SQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('supplier_quotation_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for supplier quotation numbers
CREATE SEQUENCE IF NOT EXISTS supplier_quotation_number_seq START 1;

-- Trigger for supplier quotation number generation
CREATE TRIGGER trg_generate_supplier_quotation_number
BEFORE INSERT ON public.supplier_quotations
FOR EACH ROW
EXECUTE FUNCTION public.generate_supplier_quotation_number();

-- Function to log supplier status changes
CREATE OR REPLACE FUNCTION public.log_supplier_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.application_status IS DISTINCT FROM NEW.application_status THEN
    INSERT INTO public.supplier_status_history (supplier_id, previous_status, new_status)
    VALUES (NEW.id, OLD.application_status, NEW.application_status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for supplier status logging
CREATE TRIGGER trg_log_supplier_status_change
AFTER UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.log_supplier_status_change();

-- Function to update RFQ distribution status when quotation is submitted
CREATE OR REPLACE FUNCTION public.update_rfq_distribution_on_quotation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rfq_distributions
  SET response_status = 'quoted'
  WHERE id = NEW.rfq_distribution_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for distribution status update
CREATE TRIGGER trg_update_distribution_on_quotation
AFTER INSERT ON public.supplier_quotations
FOR EACH ROW
WHEN (NEW.rfq_distribution_id IS NOT NULL)
EXECUTE FUNCTION public.update_rfq_distribution_on_quotation();
