CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 name text NOT NULL, email text, phone text, address text, city text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,email)
);
CREATE TABLE deliveries (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 sale_id uuid REFERENCES sales(id), customer_id uuid REFERENCES customers(id), branch_id uuid REFERENCES branches(id),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ASSIGNED','IN_TRANSIT','DELIVERED','CANCELLED')),
 courier text, address text NOT NULL, latitude numeric(10,7), longitude numeric(10,7), evidence_url text,
 evidence_metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE work_orders (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 customer_id uuid NOT NULL REFERENCES customers(id), branch_id uuid REFERENCES branches(id), description text NOT NULL,
 diagnosis text, quote numeric(12,2) CHECK(quote >= 0), status text NOT NULL DEFAULT 'OPEN'
 CHECK(status IN ('OPEN','DIAGNOSIS','QUOTED','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED')),
 approval_token_hash text UNIQUE, approval_expires_at timestamptz, approval_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deliveries_tenant_idx ON deliveries(tenant_id); CREATE INDEX work_orders_tenant_idx ON work_orders(tenant_id);
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['customers','deliveries','work_orders']) LOOP
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
   EXECUTE format('CREATE POLICY %I_tenant_isolation ON %I USING (tenant_id::text=current_setting(''app.tenant_id'',true)) WITH CHECK (tenant_id::text=current_setting(''app.tenant_id'',true))',t,t);
 END LOOP;
END $$;
