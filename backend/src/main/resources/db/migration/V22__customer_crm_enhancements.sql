ALTER TABLE customers ADD COLUMN IF NOT EXISTS identification_type text DEFAULT 'CEDULA';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS identification_number text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tag text DEFAULT 'REGULAR';

CREATE INDEX IF NOT EXISTS customers_tenant_id_num ON customers(tenant_id, identification_number);
CREATE INDEX IF NOT EXISTS customers_tenant_name ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS customers_tenant_tag ON customers(tenant_id, tag);

