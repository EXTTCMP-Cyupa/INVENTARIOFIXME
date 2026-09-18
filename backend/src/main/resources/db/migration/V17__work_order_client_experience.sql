ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS device_brand text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS reported_fault text,
  ADD COLUMN IF NOT EXISTS accessories text,
  ADD COLUMN IF NOT EXISTS technician_notes text,
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS client_notes text;

CREATE INDEX IF NOT EXISTS work_orders_tenant_order_number_idx ON work_orders(tenant_id, order_number);
CREATE INDEX IF NOT EXISTS work_orders_tenant_serial_idx ON work_orders(tenant_id, serial_number);

-- Backfill order_number for any existing work orders
DO $$
DECLARE
  r RECORD;
  seq INT := 1000;
  curr_tenant UUID := NULL;
BEGIN
  FOR r IN SELECT id, tenant_id FROM work_orders WHERE order_number IS NULL ORDER BY tenant_id, created_at ASC LOOP
    IF curr_tenant IS DISTINCT FROM r.tenant_id THEN
      curr_tenant := r.tenant_id;
      seq := 1000;
    END IF;
    seq := seq + 1;
    UPDATE work_orders SET order_number = 'OT-' || seq WHERE id = r.id;
  END LOOP;
END $$;

