ALTER TABLE warranties ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS claim_resolution text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES work_orders(id);
ALTER TABLE warranties ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS warranty_code text;

CREATE INDEX IF NOT EXISTS warranties_tenant_status ON warranties(tenant_id, status);
CREATE INDEX IF NOT EXISTS warranties_tenant_serial ON warranties(tenant_id, serial_number);
CREATE INDEX IF NOT EXISTS warranties_tenant_code ON warranties(tenant_id, warranty_code);
