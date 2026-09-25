-- V39: Customer Accounts, Cross-Store Deduplication, and Customer Portal

-- 1. Global Customer Accounts table (Final consumers / clients across stores)
CREATE TABLE IF NOT EXISTS customer_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    full_name TEXT NOT NULL,
    password_hash TEXT,
    city TEXT DEFAULT 'Quito',
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Link store-level customers with customer_accounts
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL;

-- 3. Link marketplace requests with customer_accounts
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL;

-- 4. Indexes for fast deduplication and phone lookup
CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone ON customer_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone_tenant ON customers(tenant_id, phone);

-- 5. Seed initial demo customer accounts from existing seed requests
INSERT INTO customer_accounts (id, phone, email, full_name, city, address)
VALUES
(
    'c1111111-1111-1111-1111-111111111101', '0998765432', 'mateo.morales@gmail.com', 'Mateo Morales', 'Quito', 'Av. República del Salvador y Moscú'
),
(
    'c1111111-1111-1111-1111-111111111102', '0984561234', 'valeria.c@hotmail.com', 'Valeria Cárdenas', 'Quito', 'Calle Francisco de Orellana 450'
),
(
    'c1111111-1111-1111-1111-111111111103', '0995544332', 'santiago.p@gmail.com', 'Santiago Paredes', 'Quito', 'Av. 6 de Diciembre y Eloy Alfaro'
)
ON CONFLICT (phone) DO NOTHING;
