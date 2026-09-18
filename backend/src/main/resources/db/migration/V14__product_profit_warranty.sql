ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_percent numeric(7,2) NOT NULL DEFAULT 0 CHECK (margin_percent >= 0);
CREATE TABLE IF NOT EXISTS warranties (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 sale_id uuid NOT NULL REFERENCES sales(id), sale_item_id uuid REFERENCES sale_items(id),
 product_id uuid NOT NULL REFERENCES products(id), customer_id uuid REFERENCES customers(id),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 terms text, status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLAIMED','EXPIRED','VOID')),
 claim_notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warranties_tenant_expiry ON warranties(tenant_id, expires_at);
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warranties_tenant_isolation ON warranties;
CREATE POLICY warranties_tenant_isolation ON warranties USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
