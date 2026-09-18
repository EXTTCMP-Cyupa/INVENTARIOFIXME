-- Enterprise authorization extensions. Existing deployments are upgraded in place.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK
 (role IN ('SUPER_ADMIN','TENANT_ADMIN','MANAGER','SELLER','DELIVERY','TECHNICIAN','ACCOUNTANT'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'STARTER';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS audit_log (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid REFERENCES tenants(id),
 actor_email text NOT NULL, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_tenant_created ON audit_log(tenant_id,created_at);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_isolation ON audit_log USING
 (tenant_id IS NULL OR tenant_id::text=current_setting('app.tenant_id',true))
 WITH CHECK (tenant_id IS NULL OR tenant_id::text=current_setting('app.tenant_id',true));
