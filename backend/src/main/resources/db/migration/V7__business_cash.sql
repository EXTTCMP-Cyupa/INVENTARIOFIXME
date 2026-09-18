ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'RETAIL';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'FREE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limits jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('SUPER_ADMIN','TENANT_ADMIN','MANAGER','SELLER','DELIVERY','TECHNICIAN','ACCOUNTANT'));
CREATE TABLE IF NOT EXISTS user_branches (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,branch_id)
);
CREATE TABLE IF NOT EXISTS cash_registers (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 branch_id uuid NOT NULL REFERENCES branches(id), name text NOT NULL DEFAULT 'Caja principal',
 active boolean NOT NULL DEFAULT true, UNIQUE(tenant_id,branch_id,name)
);
CREATE TABLE IF NOT EXISTS cash_sessions (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 register_id uuid NOT NULL REFERENCES cash_registers(id), branch_id uuid NOT NULL REFERENCES branches(id),
 opened_by uuid NOT NULL REFERENCES app_users(id), closed_by uuid REFERENCES app_users(id),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 opening_cash numeric(12,2) NOT NULL DEFAULT 0 CHECK(opening_cash>=0),
 opening_amounts jsonb NOT NULL DEFAULT '{}'::jsonb, counted_amounts jsonb,
 expected_amounts jsonb, difference_amounts jsonb, close_state text,
 UNIQUE(register_id,status)
);
CREATE TABLE IF NOT EXISTS cash_movements (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 session_id uuid NOT NULL REFERENCES cash_sessions(id), branch_id uuid NOT NULL REFERENCES branches(id),
 type text NOT NULL CHECK(type IN ('OPENING','SALE_CASH','CASH_IN','CASH_OUT','REFUND','CLOSING_ADJUSTMENT')),
 payment_method text NOT NULL CHECK(payment_method IN ('CASH','CARD','TRANSFER','OTHER')),
 amount numeric(12,2) NOT NULL CHECK(amount>0), reason text, sale_id uuid REFERENCES sales(id),
 created_by uuid NOT NULL REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES cash_sessions(id);
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY; ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_branches_tenant ON user_branches USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY cash_registers_tenant ON cash_registers USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY cash_sessions_tenant ON cash_sessions USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE POLICY cash_movements_tenant ON cash_movements USING(tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK(tenant_id::text=current_setting('app.tenant_id',true));
CREATE UNIQUE INDEX IF NOT EXISTS one_open_cash_session_per_branch ON cash_sessions(branch_id) WHERE status='OPEN';
INSERT INTO cash_registers(tenant_id,branch_id,name) SELECT tenant_id,id,'Caja principal' FROM branches b
 WHERE NOT EXISTS (SELECT 1 FROM cash_registers r WHERE r.branch_id=b.id);
