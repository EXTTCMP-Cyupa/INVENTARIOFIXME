-- Migration V43: Scaling Indices for Work Orders Cursor Pagination & Real-time Aggregation
-- Supports tens of thousands of work orders with instant filtering by status, SLA, technician, and chronological cursor.

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_status_sla 
  ON work_orders(tenant_id, status, sla_deadline);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_created_id 
  ON work_orders(tenant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_tech_status 
  ON work_orders(tenant_id, assigned_technician_id, status);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_branch_status 
  ON work_orders(tenant_id, branch_id, status);

