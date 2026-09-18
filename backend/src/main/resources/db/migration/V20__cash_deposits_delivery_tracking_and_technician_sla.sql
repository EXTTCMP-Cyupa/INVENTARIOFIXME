-- V20: Cash deposits & destinations, delivery drivers & live tracking, and technician assignment with SLA

-- 1. Cash Sessions: Deposit destination, reference, and next-day change fund
ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS deposit_destination text,
  ADD COLUMN IF NOT EXISTS deposit_reference text,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_day_fund numeric(12,2) DEFAULT 0;

-- 2. Cash Movements: Allow DEPOSIT type, plus destination and reference columns
ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS reference text;

ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_type_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_type_check
  CHECK (type IN ('OPENING','SALE_CASH','CASH_IN','CASH_OUT','DEPOSIT','REFUND','CLOSING_ADJUSTMENT'));

-- 3. Deliveries: Live tracking link (InDrive / Uber) and driver link
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS driver_id uuid;

-- 4. Delivery Drivers: Multi-tenant driver registry
CREATE TABLE IF NOT EXISTS delivery_drivers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  vehicle_type text NOT NULL DEFAULT 'MOTORCYCLE',
  external_company text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_drivers_tenant ON delivery_drivers;
CREATE POLICY delivery_drivers_tenant ON delivery_drivers
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_tenant ON delivery_drivers(tenant_id, active);

-- 5. Work Orders: Assigned technician and SLA commitments
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS assigned_technician_id uuid REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS sla_hours int NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz;

-- Populate default SLA deadline for existing open orders
UPDATE work_orders
SET sla_deadline = created_at + (sla_hours || ' hours')::interval
WHERE sla_deadline IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_technician ON work_orders(tenant_id, assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_sla ON work_orders(tenant_id, sla_deadline);

