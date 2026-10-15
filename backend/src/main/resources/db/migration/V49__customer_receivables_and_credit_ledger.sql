-- V49: Customer Receivables & Credit Ledger (Cuentas por Cobrar & Pagos en Partes)
CREATE TABLE IF NOT EXISTS customer_receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    sale_id UUID REFERENCES sales(id),
    work_order_id UUID REFERENCES work_orders(id),
    folio VARCHAR(64) NOT NULL,
    description TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    due_date DATE,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_receivables_tenant_status ON customer_receivables(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_customer ON customer_receivables(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_branch ON customer_receivables(tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS customer_receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    receivable_id UUID NOT NULL REFERENCES customer_receivables(id) ON DELETE CASCADE,
    cash_session_id UUID REFERENCES cash_sessions(id),
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    reference VARCHAR(128),
    notes TEXT,
    received_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivable_payments_receivable ON customer_receivable_payments(tenant_id, receivable_id);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_session ON customer_receivable_payments(tenant_id, cash_session_id);

