-- Migration V32: Commercial Quotes (Proformas) and Real Cash Reconciliation

-- 1. Register QUOTES module in tenant_modules
ALTER TABLE tenant_modules DROP CONSTRAINT IF EXISTS tenant_modules_module_key_check;
ALTER TABLE tenant_modules ADD CONSTRAINT tenant_modules_module_key_check
  CHECK (module_key IN ('INVENTORY','POS','DELIVERIES','WORK_ORDERS','CUSTOMERS','REPORTS','CASH_REGISTER','QUOTES'));

INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT id, 'QUOTES', true FROM tenants
ON CONFLICT DO NOTHING;

-- 2. Commercial Quotes (Proformas) Table
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    quote_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(200),
    customer_id_number VARCHAR(50),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED','CONVERTED','EXPIRED')),
    valid_until TIMESTAMPTZ,
    notes TEXT,
    terms TEXT,
    public_token VARCHAR(100) UNIQUE,
    converted_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote Items Table
CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_type VARCHAR(20) NOT NULL DEFAULT 'PRODUCT' CHECK (item_type IN ('PRODUCT','SERVICE','LABOR')),
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (tax_rate >= 0),
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for Quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY quotes_tenant ON quotes
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_items_tenant ON quote_items
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_branch ON quotes(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token);

-- 3. Enhance cash_sessions with physical denominations count and multibank balances
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS counted_breakdown JSONB;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS bank_balances JSONB;

