-- V48: Link work_orders directly to cash_sessions for comprehensive cash register audit
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES cash_sessions(id);
CREATE INDEX IF NOT EXISTS idx_work_orders_cash_session ON work_orders(tenant_id, cash_session_id);

