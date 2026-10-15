-- V51: System Activity Logs & Audit Trail (Bitácora de Auditoría)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID REFERENCES branches(id),
    user_id UUID REFERENCES app_users(id),
    user_email VARCHAR(255),
    user_role VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128),
    details TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_date ON activity_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(tenant_id, entity_type, entity_id);

