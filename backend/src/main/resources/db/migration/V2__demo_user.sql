-- Demo only. Change or remove this account before production deployment.
-- BCrypt hash for the password "password".
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
INSERT INTO app_users (tenant_id, email, password_hash, role)
SELECT '00000000-0000-0000-0000-000000000001', 'demo@fixme.local',
       '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'TENANT_ADMIN'
WHERE NOT EXISTS (
  SELECT 1 FROM app_users
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND email = 'demo@fixme.local'
);
