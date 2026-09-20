-- Add min_stock and barcode to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;

