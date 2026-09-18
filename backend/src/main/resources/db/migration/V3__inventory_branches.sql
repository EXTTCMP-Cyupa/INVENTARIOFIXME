CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE TABLE product_stock (
  product_id uuid NOT NULL REFERENCES products(id), branch_id uuid NOT NULL REFERENCES branches(id),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, branch_id)
);
CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL REFERENCES branches(id), product_id uuid NOT NULL REFERENCES products(id),
  type text NOT NULL CHECK (type IN ('IN','OUT','ADJUSTMENT')), quantity integer NOT NULL CHECK (quantity > 0),
  reason text, created_by uuid REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
ALTER TABLE product_stock FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY branches_tenant_isolation ON branches USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY stock_tenant_isolation ON product_stock USING (EXISTS (SELECT 1 FROM products p WHERE p.id=product_id AND p.tenant_id::text=current_setting('app.tenant_id',true))) WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id=product_id AND p.tenant_id::text=current_setting('app.tenant_id',true)));
CREATE POLICY movements_tenant_isolation ON inventory_movements USING (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK (tenant_id::text=current_setting('app.tenant_id',true));
INSERT INTO branches (id, tenant_id, name) VALUES ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Principal') ON CONFLICT DO NOTHING;
