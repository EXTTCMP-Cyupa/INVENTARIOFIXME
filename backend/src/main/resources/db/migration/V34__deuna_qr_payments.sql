-- Migration V34: DeUna QR Payments (Banco Pichincha / Interbank Ecuador)

-- 1. DeUna Configuration per Tenant
CREATE TABLE IF NOT EXISTS deuna_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    merchant_id VARCHAR(100) DEFAULT 'DEUNA-DEMO-001',
    merchant_name VARCHAR(255) DEFAULT 'FixmeTiendas',
    phone_number VARCHAR(50) DEFAULT '0999999999',
    api_key VARCHAR(255) DEFAULT 'sandbox_key_deuna_fixme',
    api_secret VARCHAR(255) DEFAULT 'sandbox_secret_deuna_fixme',
    environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX' CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_simulate BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for deuna_configs
ALTER TABLE deuna_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deuna_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY deuna_configs_tenant ON deuna_configs
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

-- Pre-populate default DeUna config for existing tenants
INSERT INTO deuna_configs (tenant_id, merchant_name)
SELECT id, name FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. DeUna Transactions Table
CREATE TABLE IF NOT EXISTS deuna_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    reference_type VARCHAR(30) NOT NULL DEFAULT 'POS_SALE' CHECK (reference_type IN ('POS_SALE', 'QUOTE', 'ONLINE')),
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    qr_payload TEXT NOT NULL,
    deeplink_url TEXT,
    payer_phone VARCHAR(50),
    payer_name VARCHAR(255),
    authorization_code VARCHAR(100),
    environment VARCHAR(20) NOT NULL DEFAULT 'SANDBOX',
    metadata JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for deuna_transactions
ALTER TABLE deuna_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deuna_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY deuna_transactions_tenant ON deuna_transactions
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

CREATE INDEX IF NOT EXISTS idx_deuna_tx_tenant ON deuna_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deuna_tx_id ON deuna_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_deuna_tx_quote ON deuna_transactions(quote_id);
CREATE INDEX IF NOT EXISTS idx_deuna_tx_sale ON deuna_transactions(sale_id);

