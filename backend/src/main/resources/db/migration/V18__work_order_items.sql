CREATE TABLE work_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'SERVICE' CHECK (item_type IN ('LABOR', 'PART', 'SERVICE')),
  name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_order_items_tenant_order_idx ON work_order_items(tenant_id, work_order_id);

ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY work_order_items_tenant_isolation ON work_order_items
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

