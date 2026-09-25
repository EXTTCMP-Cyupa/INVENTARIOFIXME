-- V40: Customer Accounts Identification, Deduplication, and Global Linking

-- 1. Add identification_number (Cédula/RUC) to customer_accounts if not present
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS identification_number TEXT;
CREATE INDEX IF NOT EXISTS idx_customer_accounts_id_num ON customer_accounts(identification_number);

-- 2. Backfill: Link existing store-level customers with customer_accounts by phone
UPDATE customers c
SET customer_account_id = ca.id
FROM customer_accounts ca
WHERE c.phone IS NOT NULL
  AND c.phone <> ''
  AND regexp_replace(c.phone, '[^0-9]', '', 'g') = regexp_replace(ca.phone, '[^0-9]', '', 'g')
  AND (c.customer_account_id IS NULL OR c.customer_account_id <> ca.id);

-- 3. Backfill: Link existing repair_requests with customer_accounts by customer_phone
UPDATE repair_requests r
SET customer_account_id = ca.id
FROM customer_accounts ca
WHERE r.customer_phone IS NOT NULL
  AND r.customer_phone <> ''
  AND regexp_replace(r.customer_phone, '[^0-9]', '', 'g') = regexp_replace(ca.phone, '[^0-9]', '', 'g')
  AND (r.customer_account_id IS NULL OR r.customer_account_id <> ca.id);

