-- Migration V33: Backfill tenant_modules and quote role permissions for all tenants

-- 1. Ensure all standard modules exist and are enabled for every tenant
INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT t.id, m.key, true
FROM tenants t
CROSS JOIN (
  VALUES
    ('INVENTORY'),
    ('POS'),
    ('DELIVERIES'),
    ('WORK_ORDERS'),
    ('CUSTOMERS'),
    ('REPORTS'),
    ('CASH_REGISTER'),
    ('QUOTES')
) m(key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- 2. Add 'quotes' to role_permissions for roles MANAGER, SELLER, and ACCOUNTANT if missing
UPDATE role_permissions
SET permissions = array_append(permissions, 'quotes'),
    updated_at = now()
WHERE role IN ('MANAGER', 'SELLER', 'ACCOUNTANT')
  AND NOT ('quotes' = ANY(permissions));

