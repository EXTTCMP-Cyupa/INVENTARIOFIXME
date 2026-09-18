-- Migration V26: Add billing cycle, discount, and billing contact to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_billing_cycle_check'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_billing_cycle_check
      CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'));
  END IF;
END $$;

