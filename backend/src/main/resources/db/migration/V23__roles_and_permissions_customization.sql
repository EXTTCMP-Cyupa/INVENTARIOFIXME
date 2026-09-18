-- V23: Roles and Permissions Customization & Matrix
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role)
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS custom_permissions text[];

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_tenant_isolation ON role_permissions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Seed default permissions for existing demo tenant
INSERT INTO role_permissions (tenant_id, role, permissions) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', ARRAY['home','cash','pos','sales','administration','products','customers','deliveries','work-orders','my-work','warranties','reports']),
  ('00000000-0000-0000-0000-000000000001', 'TENANT_ADMIN', ARRAY['home','cash','pos','sales','administration','products','customers','deliveries','work-orders','my-work','warranties','reports']),
  ('00000000-0000-0000-0000-000000000001', 'MANAGER', ARRAY['home','cash','pos','sales','administration','products','customers','deliveries','work-orders','my-work','warranties','reports']),
  ('00000000-0000-0000-0000-000000000001', 'SELLER', ARRAY['home','cash','pos','sales','products','customers','work-orders','warranties']),
  ('00000000-0000-0000-0000-000000000001', 'TECHNICIAN', ARRAY['home','customers','work-orders','my-work','warranties']),
  ('00000000-0000-0000-0000-000000000001', 'DELIVERY', ARRAY['home','customers','deliveries']),
  ('00000000-0000-0000-0000-000000000001', 'ACCOUNTANT', ARRAY['home','cash','sales','reports'])
ON CONFLICT (tenant_id, role) DO UPDATE SET permissions = EXCLUDED.permissions;

