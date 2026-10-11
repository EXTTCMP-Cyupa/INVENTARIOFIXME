-- V44: Product Images for Inventory and Digital Catalog
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

