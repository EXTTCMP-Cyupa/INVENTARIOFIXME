-- Ensure every branch has a default cash register
INSERT INTO cash_registers (id, tenant_id, branch_id, name, active)
SELECT uuid_generate_v4(), b.tenant_id, b.id, 'Caja principal', true
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM cash_registers r WHERE r.branch_id = b.id
)
ON CONFLICT DO NOTHING;

-- Ensure every user in app_users has an entry in user_branches linking to their tenant's primary branch
INSERT INTO user_branches (user_id, branch_id, tenant_id)
SELECT u.id, b.id, u.tenant_id
FROM app_users u
JOIN LATERAL (
  SELECT id FROM branches WHERE tenant_id = u.tenant_id ORDER BY created_at ASC LIMIT 1
) b ON true
WHERE NOT EXISTS (
  SELECT 1 FROM user_branches ub WHERE ub.user_id = u.id AND ub.tenant_id = u.tenant_id
)
ON CONFLICT DO NOTHING;

