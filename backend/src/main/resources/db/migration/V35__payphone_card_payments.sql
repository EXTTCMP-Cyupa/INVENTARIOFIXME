-- Migration V35: Payphone Credit and Debit Card Payments (Ecuador / International)

-- 1. Payphone Configuration per Tenant
CREATE TABLE IF NOT EXISTS payphone_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    token TEXT DEFAULT 'sandbox_payphone_token_fixme',
    client_id VARCHAR(100) DEFAULT 'PAYPHONE-DEMO-001',
    store_id VARCHAR(100) DEFAULT 'STORE-DEMO-001',
    environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_simulate BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for payphone_configs
ALTER TABLE payphone_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payphone_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY payphone_configs_tenant ON payphone_configs
    USING (
        current_setting('app.tenant_id', true) IS NULL 
        OR current_setting('app.tenant_id', true) = '' 
        OR tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NULL 
        OR current_setting('app.tenant_id', true) = '' 
        OR tenant_id::text = current_setting('app.tenant_id', true)
    );

-- Pre-populate default config for existing tenants
INSERT INTO payphone_configs (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Payphone Transactions Table
CREATE TABLE IF NOT EXISTS payphone_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    client_transaction_id VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELED')),
    reference_type VARCHAR(30) NOT NULL DEFAULT 'POS_SALE' CHECK (reference_type IN ('POS_SALE', 'QUOTE', 'ONLINE')),
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    payment_url TEXT,
    card_brand VARCHAR(50),
    card_last_digits VARCHAR(10),
    authorization_code VARCHAR(100),
    payer_email VARCHAR(200),
    payer_phone VARCHAR(50),
    environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX',
    metadata JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for payphone_transactions
ALTER TABLE payphone_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payphone_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY payphone_transactions_tenant ON payphone_transactions
    USING (
        current_setting('app.tenant_id', true) IS NULL 
        OR current_setting('app.tenant_id', true) = '' 
        OR tenant_id::text = current_setting('app.tenant_id', true)
    )
    WITH CHECK (
        current_setting('app.tenant_id', true) IS NULL 
        OR current_setting('app.tenant_id', true) = '' 
        OR tenant_id::text = current_setting('app.tenant_id', true)
    );

CREATE INDEX IF NOT EXISTS idx_payphone_tx_tenant ON payphone_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payphone_tx_client_id ON payphone_transactions(client_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payphone_tx_quote ON payphone_transactions(quote_id);
CREATE INDEX IF NOT EXISTS idx_payphone_tx_sale ON payphone_transactions(sale_id);

