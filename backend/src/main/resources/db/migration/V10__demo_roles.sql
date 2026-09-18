SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', false);

INSERT INTO app_users (tenant_id, email, password_hash, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'manager@fixme.local',
   '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'MANAGER'),
  ('00000000-0000-0000-0000-000000000001', 'seller@fixme.local',
   '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'SELLER'),
  ('00000000-0000-0000-0000-000000000001', 'delivery@fixme.local',
   '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'DELIVERY'),
  ('00000000-0000-0000-0000-000000000001', 'technician@fixme.local',
   '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'TECHNICIAN'),
  ('00000000-0000-0000-0000-000000000001', 'accountant@fixme.local',
   '$2a$10$W0HZt5uNbYR/a8xROG3eteXD4ju7lxcWX5gtmtLJMy2YZIKw11iOm', 'ACCOUNTANT')
ON CONFLICT (tenant_id, email) DO NOTHING;
