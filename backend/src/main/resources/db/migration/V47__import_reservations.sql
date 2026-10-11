-- Migration V47: Customer Pre-Order Reservations for Imports
CREATE TABLE IF NOT EXISTS import_item_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  item_id UUID NOT NULL REFERENCES import_items(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  deposit_amount NUMERIC(12,2) DEFAULT 0.00,
  notes TEXT,
  notified_transit BOOLEAN NOT NULL DEFAULT false,
  notified_arrival BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_res_tenant ON import_item_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_res_item ON import_item_reservations(item_id);

ALTER TABLE import_item_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_item_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_res_tenant_isolation ON import_item_reservations;
CREATE POLICY import_res_tenant_isolation ON import_item_reservations USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

