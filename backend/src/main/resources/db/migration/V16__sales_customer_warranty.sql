ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS warranty_days integer NOT NULL DEFAULT 0 CHECK (warranty_days >= 0);

CREATE INDEX IF NOT EXISTS sales_tenant_customer_created
  ON sales(tenant_id, customer_id, created_at DESC);
