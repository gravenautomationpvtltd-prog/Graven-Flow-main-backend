-- Ensure an account exists, return its id
CREATE OR REPLACE FUNCTION public.coa_ensure(_tenant UUID, _code TEXT, _name TEXT, _type TEXT, _group TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _id UUID;
BEGIN
  SELECT id INTO _id FROM public.chart_of_accounts WHERE tenant_id = _tenant AND code = _code;
  IF _id IS NULL THEN
    INSERT INTO public.chart_of_accounts (tenant_id, code, name, account_type, statement_group, is_system)
    VALUES (_tenant, _code, _name, _type, _group, true)
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO _id;
  END IF;
  RETURN _id;
END;
$$;

-- Seed the standard chart of accounts for a tenant
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(_tenant UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.coa_ensure(_tenant,'1000','Cash in Hand','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1010','Bank Accounts','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1100','Accounts Receivable','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1201','Input CGST','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1202','Input SGST','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1203','Input IGST','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1300','Closing Stock','asset','current_asset');
  PERFORM public.coa_ensure(_tenant,'1500','Fixed Assets','asset','fixed_asset');
  PERFORM public.coa_ensure(_tenant,'1590','Accumulated Depreciation','asset','fixed_asset');
  PERFORM public.coa_ensure(_tenant,'2000','Accounts Payable','liability','current_liability');
  PERFORM public.coa_ensure(_tenant,'2101','Output CGST','liability','current_liability');
  PERFORM public.coa_ensure(_tenant,'2102','Output SGST','liability','current_liability');
  PERFORM public.coa_ensure(_tenant,'2103','Output IGST','liability','current_liability');
  PERFORM public.coa_ensure(_tenant,'2200','Duties & Taxes Payable','liability','current_liability');
  PERFORM public.coa_ensure(_tenant,'3000','Capital Account','equity','equity');
  PERFORM public.coa_ensure(_tenant,'3900','Retained Earnings','equity','equity');
  PERFORM public.coa_ensure(_tenant,'4000','Sales','income','sales');
  PERFORM public.coa_ensure(_tenant,'4900','Other Income','income','other_income');
  PERFORM public.coa_ensure(_tenant,'5000','Purchases','expense','purchases');
  PERFORM public.coa_ensure(_tenant,'5100','Freight & Customs','expense','direct_expense');
  PERFORM public.coa_ensure(_tenant,'6000','Indirect Expenses','expense','indirect_expense');
  PERFORM public.coa_ensure(_tenant,'6100','Salaries & Wages','expense','indirect_expense');
  PERFORM public.coa_ensure(_tenant,'6200','Rent','expense','indirect_expense');
  PERFORM public.coa_ensure(_tenant,'6300','Travel & Conveyance','expense','indirect_expense');
  PERFORM public.coa_ensure(_tenant,'6400','Depreciation','expense','indirect_expense');
END;
$$;

-- Replace all ledger lines for one source document
CREATE OR REPLACE FUNCTION public.post_ledger(
  _tenant UUID, _date DATE, _source_type TEXT, _source_id UUID, _ref TEXT, _lines JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _line JSONB;
  _account UUID;
BEGIN
  DELETE FROM public.ledger_entries WHERE source_type = _source_type AND source_id = _source_id;
  IF _tenant IS NULL OR _lines IS NULL THEN RETURN; END IF;

  FOR _line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF COALESCE((_line->>'debit')::NUMERIC,0) = 0 AND COALESCE((_line->>'credit')::NUMERIC,0) = 0 THEN
      CONTINUE;
    END IF;
    _account := public.coa_ensure(
      _tenant,
      _line->>'code',
      COALESCE(_line->>'name', _line->>'code'),
      COALESCE(_line->>'type','expense'),
      COALESCE(_line->>'grp','indirect_expense')
    );
    INSERT INTO public.ledger_entries (tenant_id, entry_date, account_id, debit, credit, narration, source_type, source_id, source_ref, party_type, party_id)
    VALUES (
      _tenant, _date, _account,
      COALESCE((_line->>'debit')::NUMERIC,0),
      COALESCE((_line->>'credit')::NUMERIC,0),
      _line->>'narration', _source_type, _source_id, _ref,
      _line->>'party_type', NULLIF(_line->>'party_id','')::UUID
    );
  END LOOP;
END;
$$;

-- ---------- Sales invoices ----------
CREATE OR REPLACE FUNCTION public.post_invoice_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _tenant UUID; _taxable NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='invoice' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT c.tenant_id INTO _tenant FROM public.customers c WHERE c.id = NEW.customer_id;
  IF _tenant IS NULL THEN _tenant := public.get_user_tenant_id(NEW.created_by); END IF;
  IF _tenant IS NULL THEN RETURN NEW; END IF;

  IF COALESCE(NEW.status,'') = 'cancelled' THEN
    DELETE FROM public.ledger_entries WHERE source_type='invoice' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  _taxable := COALESCE(NEW.grand_total,0) - COALESCE(NEW.total_tax,0);

  PERFORM public.post_ledger(_tenant, NEW.invoice_date, 'invoice', NEW.id, NEW.invoice_number, jsonb_build_array(
    jsonb_build_object('code','1100','name','Accounts Receivable','type','asset','grp','current_asset','debit',COALESCE(NEW.grand_total,0),'party_type','customer','party_id',NEW.customer_id,'narration','Sales invoice '||COALESCE(NEW.invoice_number,'')),
    jsonb_build_object('code','4000','name','Sales','type','income','grp','sales','credit',_taxable),
    jsonb_build_object('code','2101','name','Output CGST','type','liability','grp','current_liability','credit',COALESCE(NEW.cgst_amount,0)),
    jsonb_build_object('code','2102','name','Output SGST','type','liability','grp','current_liability','credit',COALESCE(NEW.sgst_amount,0)),
    jsonb_build_object('code','2103','name','Output IGST','type','liability','grp','current_liability','credit',COALESCE(NEW.igst_amount,0))
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_invoice_ledger ON public.invoices;
CREATE TRIGGER trg_post_invoice_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.post_invoice_to_ledger();

-- ---------- Customer receipts ----------
CREATE OR REPLACE FUNCTION public.post_customer_payment_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _tenant UUID; _code TEXT; _name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='customer_payment' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT c.tenant_id INTO _tenant FROM public.customers c WHERE c.id = NEW.customer_id;
  IF _tenant IS NULL THEN RETURN NEW; END IF;

  IF NEW.payment_mode = 'cash' THEN _code := '1000'; _name := 'Cash in Hand';
  ELSE _code := '1010'; _name := 'Bank Accounts'; END IF;

  PERFORM public.post_ledger(_tenant, NEW.payment_date, 'customer_payment', NEW.id, NEW.transaction_reference, jsonb_build_array(
    jsonb_build_object('code',_code,'name',_name,'type','asset','grp','current_asset','debit',COALESCE(NEW.amount,0),'narration','Receipt from customer'),
    jsonb_build_object('code','1100','name','Accounts Receivable','type','asset','grp','current_asset','credit',COALESCE(NEW.amount,0),'party_type','customer','party_id',NEW.customer_id)
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_customer_payment_ledger ON public.customer_payments;
CREATE TRIGGER trg_post_customer_payment_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.post_customer_payment_to_ledger();

-- ---------- Purchase bills ----------
CREATE OR REPLACE FUNCTION public.post_purchase_bill_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='purchase_bill' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.post_ledger(NEW.tenant_id, NEW.bill_date, 'purchase_bill', NEW.id, NEW.bill_number, jsonb_build_array(
    jsonb_build_object('code','5000','name','Purchases','type','expense','grp','purchases','debit',COALESCE(NEW.subtotal,0),'narration','Purchase bill '||COALESCE(NEW.bill_number,'')),
    jsonb_build_object('code','5100','name','Freight & Customs','type','expense','grp','direct_expense','debit',COALESCE(NEW.other_charges,0)),
    jsonb_build_object('code','1201','name','Input CGST','type','asset','grp','current_asset','debit',COALESCE(NEW.cgst_amount,0)),
    jsonb_build_object('code','1202','name','Input SGST','type','asset','grp','current_asset','debit',COALESCE(NEW.sgst_amount,0)),
    jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(NEW.igst_amount,0)),
    jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','credit',COALESCE(NEW.grand_total,0),'party_type','supplier','party_id',NEW.supplier_id)
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_purchase_bill_ledger ON public.purchase_bills;
CREATE TRIGGER trg_post_purchase_bill_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_bills
FOR EACH ROW EXECUTE FUNCTION public.post_purchase_bill_to_ledger();

-- ---------- Supplier payments ----------
CREATE OR REPLACE FUNCTION public.post_supplier_payment_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _tenant UUID; _code TEXT; _name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='supplier_payment' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT public.get_user_tenant_id(s.created_by) INTO _tenant FROM public.suppliers s WHERE s.id = NEW.supplier_id;
  IF _tenant IS NULL THEN _tenant := public.get_user_tenant_id(NEW.paid_by); END IF;
  IF _tenant IS NULL THEN RETURN NEW; END IF;

  IF NEW.payment_mode = 'cash' THEN _code := '1000'; _name := 'Cash in Hand';
  ELSE _code := '1010'; _name := 'Bank Accounts'; END IF;

  PERFORM public.post_ledger(_tenant, NEW.payment_date, 'supplier_payment', NEW.id, NEW.transaction_reference, jsonb_build_array(
    jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','debit',COALESCE(NEW.amount,0),'party_type','supplier','party_id',NEW.supplier_id,'narration','Payment to supplier'),
    jsonb_build_object('code',_code,'name',_name,'type','asset','grp','current_asset','credit',COALESCE(NEW.amount,0))
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_supplier_payment_ledger ON public.supplier_payments;
CREATE TRIGGER trg_post_supplier_payment_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION public.post_supplier_payment_to_ledger();

-- ---------- Import invoices ----------
CREATE OR REPLACE FUNCTION public.post_import_invoice_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _goods NUMERIC; _charges NUMERIC; _total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='import_invoice' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  _goods := COALESCE(NEW.subtotal,0) * COALESCE(NEW.exchange_rate,1);
  _charges := COALESCE(NEW.shipping_charges,0) + COALESCE(NEW.insurance,0) + COALESCE(NEW.customs_duty,0) + COALESCE(NEW.other_charges,0);
  _total := COALESCE(NEW.grand_total_inr, _goods + _charges + COALESCE(NEW.igst_amount,0));

  PERFORM public.post_ledger(NEW.tenant_id, NEW.invoice_date, 'import_invoice', NEW.id, NEW.invoice_number, jsonb_build_array(
    jsonb_build_object('code','5000','name','Purchases','type','expense','grp','purchases','debit',_goods,'narration','Import invoice '||COALESCE(NEW.invoice_number,'')),
    jsonb_build_object('code','5100','name','Freight & Customs','type','expense','grp','direct_expense','debit',_charges),
    jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(NEW.igst_amount,0)),
    jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','credit',_total,'party_type','supplier','party_id',NEW.supplier_id)
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_import_invoice_ledger ON public.import_invoices;
CREATE TRIGGER trg_post_import_invoice_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.import_invoices
FOR EACH ROW EXECUTE FUNCTION public.post_import_invoice_to_ledger();

-- ---------- Expenses ----------
CREATE OR REPLACE FUNCTION public.post_expense_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _code TEXT; _name TEXT; _pay_code TEXT; _pay_name TEXT; _total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='expense' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT a.code, a.name INTO _code, _name FROM public.chart_of_accounts a WHERE a.id = NEW.account_id;
  IF _code IS NULL THEN _code := '6000'; _name := 'Indirect Expenses'; END IF;

  _total := COALESCE(NEW.total_amount, COALESCE(NEW.amount,0)+COALESCE(NEW.cgst_amount,0)+COALESCE(NEW.sgst_amount,0)+COALESCE(NEW.igst_amount,0));

  IF NEW.is_paid THEN
    IF NEW.payment_mode = 'cash' THEN _pay_code := '1000'; _pay_name := 'Cash in Hand';
    ELSE _pay_code := '1010'; _pay_name := 'Bank Accounts'; END IF;
    PERFORM public.post_ledger(NEW.tenant_id, NEW.expense_date, 'expense', NEW.id, NEW.bill_number, jsonb_build_array(
      jsonb_build_object('code',_code,'name',_name,'type','expense','grp','indirect_expense','debit',COALESCE(NEW.amount,0),'narration',COALESCE(NEW.description,'Expense')),
      jsonb_build_object('code','1201','name','Input CGST','type','asset','grp','current_asset','debit',COALESCE(NEW.cgst_amount,0)),
      jsonb_build_object('code','1202','name','Input SGST','type','asset','grp','current_asset','debit',COALESCE(NEW.sgst_amount,0)),
      jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(NEW.igst_amount,0)),
      jsonb_build_object('code',_pay_code,'name',_pay_name,'type','asset','grp','current_asset','credit',_total)
    ));
  ELSE
    PERFORM public.post_ledger(NEW.tenant_id, NEW.expense_date, 'expense', NEW.id, NEW.bill_number, jsonb_build_array(
      jsonb_build_object('code',_code,'name',_name,'type','expense','grp','indirect_expense','debit',COALESCE(NEW.amount,0),'narration',COALESCE(NEW.description,'Expense')),
      jsonb_build_object('code','1201','name','Input CGST','type','asset','grp','current_asset','debit',COALESCE(NEW.cgst_amount,0)),
      jsonb_build_object('code','1202','name','Input SGST','type','asset','grp','current_asset','debit',COALESCE(NEW.sgst_amount,0)),
      jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(NEW.igst_amount,0)),
      jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','credit',_total,'party_type','supplier','party_id',NEW.supplier_id)
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_expense_ledger ON public.expenses;
CREATE TRIGGER trg_post_expense_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.post_expense_to_ledger();

-- ---------- Fixed assets ----------
CREATE OR REPLACE FUNCTION public.post_fixed_asset_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _total NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE source_type='fixed_asset' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  _total := COALESCE(NEW.purchase_value,0) + COALESCE(NEW.gst_amount,0);

  PERFORM public.post_ledger(NEW.tenant_id, NEW.purchase_date, 'fixed_asset', NEW.id, NEW.bill_number, jsonb_build_array(
    jsonb_build_object('code','1500','name','Fixed Assets','type','asset','grp','fixed_asset','debit',COALESCE(NEW.purchase_value,0),'narration',COALESCE(NEW.name,'Asset purchase')),
    jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(NEW.gst_amount,0)),
    jsonb_build_object('code','1010','name','Bank Accounts','type','asset','grp','current_asset','credit',_total)
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_fixed_asset_ledger ON public.fixed_assets;
CREATE TRIGGER trg_post_fixed_asset_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.post_fixed_asset_to_ledger();

-- ---------- Back-posting helper for existing documents ----------
CREATE OR REPLACE FUNCTION public.backpost_accounting(_tenant UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; _inv INT := 0; _cp INT := 0; _sp INT := 0; _ii INT := 0;
BEGIN
  PERFORM public.seed_chart_of_accounts(_tenant);

  FOR r IN SELECT i.* FROM public.invoices i JOIN public.customers c ON c.id = i.customer_id
           WHERE c.tenant_id = _tenant AND COALESCE(i.status,'') <> 'cancelled' LOOP
    PERFORM public.post_ledger(_tenant, r.invoice_date, 'invoice', r.id, r.invoice_number, jsonb_build_array(
      jsonb_build_object('code','1100','name','Accounts Receivable','type','asset','grp','current_asset','debit',COALESCE(r.grand_total,0),'party_type','customer','party_id',r.customer_id,'narration','Sales invoice '||COALESCE(r.invoice_number,'')),
      jsonb_build_object('code','4000','name','Sales','type','income','grp','sales','credit',COALESCE(r.grand_total,0)-COALESCE(r.total_tax,0)),
      jsonb_build_object('code','2101','name','Output CGST','type','liability','grp','current_liability','credit',COALESCE(r.cgst_amount,0)),
      jsonb_build_object('code','2102','name','Output SGST','type','liability','grp','current_liability','credit',COALESCE(r.sgst_amount,0)),
      jsonb_build_object('code','2103','name','Output IGST','type','liability','grp','current_liability','credit',COALESCE(r.igst_amount,0))
    ));
    _inv := _inv + 1;
  END LOOP;

  FOR r IN SELECT p.* FROM public.customer_payments p JOIN public.customers c ON c.id = p.customer_id
           WHERE c.tenant_id = _tenant LOOP
    PERFORM public.post_ledger(_tenant, r.payment_date, 'customer_payment', r.id, r.transaction_reference, jsonb_build_array(
      jsonb_build_object('code', CASE WHEN r.payment_mode = 'cash' THEN '1000' ELSE '1010' END,'name', CASE WHEN r.payment_mode = 'cash' THEN 'Cash in Hand' ELSE 'Bank Accounts' END,'type','asset','grp','current_asset','debit',COALESCE(r.amount,0),'narration','Receipt from customer'),
      jsonb_build_object('code','1100','name','Accounts Receivable','type','asset','grp','current_asset','credit',COALESCE(r.amount,0),'party_type','customer','party_id',r.customer_id)
    ));
    _cp := _cp + 1;
  END LOOP;

  FOR r IN SELECT sp.* FROM public.supplier_payments sp JOIN public.suppliers s ON s.id = sp.supplier_id
           WHERE public.get_user_tenant_id(s.created_by) = _tenant LOOP
    PERFORM public.post_ledger(_tenant, r.payment_date, 'supplier_payment', r.id, r.transaction_reference, jsonb_build_array(
      jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','debit',COALESCE(r.amount,0),'party_type','supplier','party_id',r.supplier_id,'narration','Payment to supplier'),
      jsonb_build_object('code', CASE WHEN r.payment_mode = 'cash' THEN '1000' ELSE '1010' END,'name', CASE WHEN r.payment_mode = 'cash' THEN 'Cash in Hand' ELSE 'Bank Accounts' END,'type','asset','grp','current_asset','credit',COALESCE(r.amount,0))
    ));
    _sp := _sp + 1;
  END LOOP;

  FOR r IN SELECT * FROM public.import_invoices WHERE tenant_id = _tenant LOOP
    PERFORM public.post_ledger(_tenant, r.invoice_date, 'import_invoice', r.id, r.invoice_number, jsonb_build_array(
      jsonb_build_object('code','5000','name','Purchases','type','expense','grp','purchases','debit',COALESCE(r.subtotal,0)*COALESCE(r.exchange_rate,1),'narration','Import invoice '||COALESCE(r.invoice_number,'')),
      jsonb_build_object('code','5100','name','Freight & Customs','type','expense','grp','direct_expense','debit',COALESCE(r.shipping_charges,0)+COALESCE(r.insurance,0)+COALESCE(r.customs_duty,0)+COALESCE(r.other_charges,0)),
      jsonb_build_object('code','1203','name','Input IGST','type','asset','grp','current_asset','debit',COALESCE(r.igst_amount,0)),
      jsonb_build_object('code','2000','name','Accounts Payable','type','liability','grp','current_liability','credit',COALESCE(r.grand_total_inr,0),'party_type','supplier','party_id',r.supplier_id)
    ));
    _ii := _ii + 1;
  END LOOP;

  RETURN jsonb_build_object('invoices',_inv,'customer_payments',_cp,'supplier_payments',_sp,'import_invoices',_ii);
END;
$$;

GRANT EXECUTE ON FUNCTION public.backpost_accounting(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_chart_of_accounts(UUID) TO authenticated;
