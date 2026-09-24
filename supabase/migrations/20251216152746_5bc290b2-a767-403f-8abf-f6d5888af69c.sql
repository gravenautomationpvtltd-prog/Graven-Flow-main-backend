-- Add new values to order_document_type enum
ALTER TYPE order_document_type ADD VALUE IF NOT EXISTS 'tax_invoice';
ALTER TYPE order_document_type ADD VALUE IF NOT EXISTS 'eway_bill';
ALTER TYPE order_document_type ADD VALUE IF NOT EXISTS 'awb';
ALTER TYPE order_document_type ADD VALUE IF NOT EXISTS 'product_image';

-- Add notes column to order_documents for custom document names
ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS notes TEXT;