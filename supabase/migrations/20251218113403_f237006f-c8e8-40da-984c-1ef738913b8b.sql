-- Add price tracking columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_updated_by UUID REFERENCES profiles(id);

-- Initialize existing products with current updated_at
UPDATE products SET price_updated_at = COALESCE(updated_at, now()) WHERE price_updated_at IS NULL;

-- Create trigger function to track price changes
CREATE OR REPLACE FUNCTION track_product_price_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.default_rate IS DISTINCT FROM NEW.default_rate) OR 
     (OLD.purchase_price IS DISTINCT FROM NEW.purchase_price) THEN
    NEW.price_updated_at := now();
    NEW.price_updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for price tracking
DROP TRIGGER IF EXISTS track_product_price_changes ON products;
CREATE TRIGGER track_product_price_changes
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION track_product_price_update();