-- V19: Sales channels, fulfillment types (pickup/delivery), historical cost tracking, and delivery details

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'STORE' CHECK (channel IN ('STORE', 'ONLINE')),
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'PICKUP' CHECK (fulfillment_type IN ('PICKUP', 'DELIVERY')),
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  ADD COLUMN IF NOT EXISTS delivery_notes text;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz;

-- Populate existing sale_items cost_price from product purchase_price
UPDATE sale_items si
SET cost_price = COALESCE(p.purchase_price, 0)
FROM products p
WHERE p.id = si.product_id AND si.cost_price = 0;

CREATE INDEX IF NOT EXISTS sales_tenant_channel_created ON sales(tenant_id, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_tenant_fulfillment_created ON sales(tenant_id, fulfillment_type, created_at DESC);
CREATE INDEX IF NOT EXISTS deliveries_tenant_status ON deliveries(tenant_id, status, created_at DESC);

