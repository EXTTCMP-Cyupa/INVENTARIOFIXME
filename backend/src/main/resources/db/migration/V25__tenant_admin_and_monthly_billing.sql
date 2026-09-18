-- V25: Add monthly billing, subscription tracking, and payment history for TENANT_ADMIN (SaaS Owner)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS monthly_fee numeric(10,2) NOT NULL DEFAULT 49.00;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_billing_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_date date DEFAULT CURRENT_DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'PAID';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add check constraint for payment status if not exists
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_payment_status_check CHECK (payment_status IN ('PAID', 'PENDING', 'OVERDUE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table for tracking monthly subscription payments recorded by the system owner
CREATE TABLE IF NOT EXISTS tenant_subscription_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  period_covered text NOT NULL,
  payment_method text NOT NULL DEFAULT 'TRANSFER',
  reference text,
  recorded_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_sub_payments ON tenant_subscription_payments(tenant_id, payment_date DESC);

-- Seed initial monthly payment for Demo Tenant
INSERT INTO tenant_subscription_payments (tenant_id, amount, payment_date, period_covered, payment_method, reference, recorded_by, notes)
SELECT
  '00000000-0000-0000-0000-000000000001',
  49.00,
  CURRENT_DATE,
  to_char(CURRENT_DATE, 'TMMonth YYYY'),
  'TRANSFER',
  'TRANSF-INICIAL-PICHINCHA',
  'admin@fixme.local',
  'Mensualidad inicial de tienda demo'
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_subscription_payments WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

UPDATE tenants
SET monthly_fee = 49.00,
    subscription_status = 'ACTIVE',
    payment_status = 'PAID',
    next_billing_date = CURRENT_DATE + interval '30 days',
    last_payment_date = CURRENT_DATE
WHERE id = '00000000-0000-0000-0000-000000000001';

