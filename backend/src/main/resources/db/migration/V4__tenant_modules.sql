CREATE TABLE tenant_modules (
  tenant_id uuid NOT NULL REFERENCES tenants(id), module_key text NOT NULL
    CHECK (module_key IN ('INVENTORY','POS','DELIVERIES','WORK_ORDERS','CUSTOMERS','REPORTS')),
  enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id,module_key)
);
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_modules_isolation ON tenant_modules USING
 (tenant_id::text=current_setting('app.tenant_id',true)) WITH CHECK
 (tenant_id::text=current_setting('app.tenant_id',true));
SELECT set_config('app.tenant_id','00000000-0000-0000-0000-000000000001',false);
INSERT INTO tenant_modules(tenant_id,module_key,enabled)
 SELECT t.id,m.key,true FROM tenants t CROSS JOIN
 (VALUES ('INVENTORY'),('POS'),('DELIVERIES'),('WORK_ORDERS'),('CUSTOMERS'),('REPORTS')) m(key)
 ON CONFLICT DO NOTHING;
