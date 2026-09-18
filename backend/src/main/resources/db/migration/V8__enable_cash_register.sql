ALTER TABLE tenant_modules DROP CONSTRAINT IF EXISTS tenant_modules_module_key_check;
ALTER TABLE tenant_modules ADD CONSTRAINT tenant_modules_module_key_check
  CHECK (module_key IN ('INVENTORY','POS','DELIVERIES','WORK_ORDERS','CUSTOMERS','REPORTS','CASH_REGISTER'));

INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT '00000000-0000-0000-0000-000000000001', 'CASH_REGISTER', true
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_modules
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND module_key = 'CASH_REGISTER'
);
