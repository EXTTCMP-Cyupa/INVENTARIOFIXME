CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app_users (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid REFERENCES tenants(id), email text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('SUPER_ADMIN','TENANT_ADMIN','SELLER','DELIVERY')), UNIQUE(tenant_id,email));
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id), sku text NOT NULL, name text NOT NULL, stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0), price numeric(12,2) NOT NULL CHECK(price >= 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,sku));
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON app_users
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
INSERT INTO tenants (id,name) VALUES ('00000000-0000-0000-0000-000000000001','Demo tenant') ON CONFLICT DO NOTHING;
