-- Product landed cost includes purchase cost plus optional freight/handling costs.
ALTER TABLE products ADD COLUMN IF NOT EXISTS extra_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0);
CREATE INDEX IF NOT EXISTS warranties_tenant_sale ON warranties(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS warranties_tenant_product ON warranties(tenant_id, product_id);
