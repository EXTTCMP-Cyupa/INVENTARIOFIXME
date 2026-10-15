-- V50: Sale Returns, Restocking & SRI Credit Notes (Devoluciones y Notas de Crédito)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_status VARCHAR(32) DEFAULT 'NONE';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_amount NUMERIC(12, 2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS sale_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    cash_session_id UUID REFERENCES cash_sessions(id),
    folio VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    refund_payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    restock_items BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sale_return_id UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sri_credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sale_return_id UUID REFERENCES sale_returns(id),
    sale_id UUID REFERENCES sales(id),
    original_invoice_id UUID REFERENCES electronic_invoices(id),
    original_invoice_number VARCHAR(64),
    clave_acceso VARCHAR(64) UNIQUE,
    secuencial VARCHAR(16),
    numero_completo VARCHAR(64),
    motivo TEXT NOT NULL,
    total_modificacion NUMERIC(12, 2) NOT NULL,
    estado_sri VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    fecha_autorizacion TIMESTAMPTZ,
    numero_autorizacion VARCHAR(64),
    xml_firmado TEXT,
    mensajes_sri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_tenant_sale ON sale_returns(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_sri_credit_notes_tenant ON sri_credit_notes(tenant_id, clave_acceso);

