-- =========================================================
-- Accounting foundation: chart of accounts + double entry
-- =========================================================

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'asset',
  statement_group TEXT NOT NULL DEFAULT 'current_asset',
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  opening_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view accounts" ON public.chart_of_accounts
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can insert accounts" ON public.chart_of_accounts
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update accounts" ON public.chart_of_accounts
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Admins can delete accounts" ON public.chart_of_accounts
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()) AND is_system = false);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  narration TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  source_ref TEXT,
  party_type TEXT,
  party_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_date ON public.ledger_entries(tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_account_date ON public.ledger_entries(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON public.ledger_entries(source_type, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view ledger" ON public.ledger_entries
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can insert ledger" ON public.ledger_entries
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update ledger" ON public.ledger_entries
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can delete ledger" ON public.ledger_entries
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));

-- =========================================================
-- Bank / cash accounts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bank',
  bank_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  opening_date DATE,
  coa_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view bank accounts" ON public.bank_accounts
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can insert bank accounts" ON public.bank_accounts
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update bank accounts" ON public.bank_accounts
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Admins can delete bank accounts" ON public.bank_accounts
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()));

-- =========================================================
-- Purchase bills (supplier tax invoices)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  supplier_gstin TEXT,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  place_of_supply TEXT,
  is_igst BOOLEAN NOT NULL DEFAULT false,
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  itc_eligible BOOLEAN NOT NULL DEFAULT true,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  cgst_amount NUMERIC NOT NULL DEFAULT 0,
  sgst_amount NUMERIC NOT NULL DEFAULT 0,
  igst_amount NUMERIC NOT NULL DEFAULT 0,
  total_tax NUMERIC NOT NULL DEFAULT 0,
  other_charges NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recorded',
  attachment_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id, bill_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_tenant_date ON public.purchase_bills(tenant_id, bill_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_bills TO authenticated;
GRANT ALL ON public.purchase_bills TO service_role;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view purchase bills" ON public.purchase_bills
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Procurement and accounts can insert purchase bills" ON public.purchase_bills
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_procurement_or_above(auth.uid())));
CREATE POLICY "Procurement and accounts can update purchase bills" ON public.purchase_bills
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_procurement_or_above(auth.uid())));
CREATE POLICY "Admins can delete purchase bills" ON public.purchase_bills
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()));

CREATE TABLE IF NOT EXISTS public.purchase_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  hsn_code TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Nos',
  rate NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 18,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill ON public.purchase_bill_items(bill_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_bill_items TO authenticated;
GRANT ALL ON public.purchase_bill_items TO service_role;
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view purchase bill items" ON public.purchase_bill_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND public.is_my_tenant(b.tenant_id)));
CREATE POLICY "Team can insert purchase bill items" ON public.purchase_bill_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND public.is_my_tenant(b.tenant_id)));
CREATE POLICY "Team can update purchase bill items" ON public.purchase_bill_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND public.is_my_tenant(b.tenant_id)));
CREATE POLICY "Team can delete purchase bill items" ON public.purchase_bill_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.purchase_bills b WHERE b.id = bill_id AND public.is_my_tenant(b.tenant_id)));

-- =========================================================
-- Expenses
-- =========================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  category TEXT,
  description TEXT,
  vendor_name TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_gstin TEXT,
  bill_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  cgst_amount NUMERIC NOT NULL DEFAULT 0,
  sgst_amount NUMERIC NOT NULL DEFAULT 0,
  igst_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  hsn_code TEXT,
  payment_mode TEXT NOT NULL DEFAULT 'bank',
  paid_from_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  attachment_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON public.expenses(tenant_id, expense_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view expenses" ON public.expenses
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can insert expenses" ON public.expenses
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update expenses" ON public.expenses
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Admins can delete expenses" ON public.expenses
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()));

-- =========================================================
-- Fixed assets
-- =========================================================
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_category TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_value NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  depreciation_rate NUMERIC NOT NULL DEFAULT 15,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_name TEXT,
  bill_number TEXT,
  paid_from_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  disposed_on DATE,
  disposal_value NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view fixed assets" ON public.fixed_assets
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can insert fixed assets" ON public.fixed_assets
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update fixed assets" ON public.fixed_assets
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Admins can delete fixed assets" ON public.fixed_assets
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()));

-- =========================================================
-- Accounting period locks
-- =========================================================
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  gstr1_filed_at TIMESTAMPTZ,
  gstr3b_filed_at TIMESTAMPTZ,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, period_end)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view periods" ON public.accounting_periods
  FOR SELECT USING (public.is_my_tenant(tenant_id));
CREATE POLICY "Accounts team can manage periods" ON public.accounting_periods
  FOR INSERT WITH CHECK (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Accounts team can update periods" ON public.accounting_periods
  FOR UPDATE USING (public.is_my_tenant(tenant_id) AND (public.has_role(auth.uid(),'accounts') OR public.is_admin_or_above(auth.uid())));
CREATE POLICY "Admins can delete periods" ON public.accounting_periods
  FOR DELETE USING (public.is_my_tenant(tenant_id) AND public.is_admin_or_above(auth.uid()));
