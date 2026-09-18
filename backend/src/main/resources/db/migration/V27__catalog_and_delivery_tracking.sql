-- Migration V27: Digital catalog settings and delivery tracking index
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS catalog_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_description TEXT,
  ADD COLUMN IF NOT EXISTS catalog_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;

-- Create index for fast public tracking queries
CREATE INDEX IF NOT EXISTS deliveries_tracking_number_idx ON deliveries (tracking_number);

-- Backfill tracking_number for any existing deliveries without one
UPDATE deliveries
SET tracking_number = 'TRK-' || lpad((floor(random() * 900000) + 100000)::text, 6, '0')
WHERE tracking_number IS NULL OR tracking_number = '';

