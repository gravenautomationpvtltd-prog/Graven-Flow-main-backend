-- Migration: Add product specification snapshot columns to quotation_items
-- Date: 2026-10-10
-- Purpose: Persist auto-filled / edited specifications (dimensions, unit_weight_kg, total_weight_kg)
--          so that future catalog changes do not alter historic quotations and PDFs.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS unit_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS total_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS dimensions text;

COMMENT ON COLUMN public.quotation_items.unit_weight_kg IS 'Snapshotted unit weight in KG for quotation line item';
COMMENT ON COLUMN public.quotation_items.total_weight_kg IS 'Calculated total weight in KG (quantity * unit_weight_kg)';
COMMENT ON COLUMN public.quotation_items.dimensions IS 'Snapshotted dimensions text (e.g. L x W x H CM) for quotation line item';
