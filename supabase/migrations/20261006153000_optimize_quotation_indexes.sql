-- Performance optimization indexes for quotations and price versions
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_product_price_versions_product_id ON public.product_price_versions(product_id);
