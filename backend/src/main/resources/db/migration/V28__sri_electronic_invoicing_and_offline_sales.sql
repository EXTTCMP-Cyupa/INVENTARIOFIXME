-- Migration V28: SRI Electronic Invoicing (Ecuador) and Offline Sales Support

-- 1. Configuration for Tenant SRI Invoicing and Digital Signature (.p12)
CREATE TABLE IF NOT EXISTS tenant_sri_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ruc VARCHAR(13) NOT NULL,
    razon_social VARCHAR(300) NOT NULL,
    nombre_comercial VARCHAR(300),
    direccion_matriz VARCHAR(500) NOT NULL,
    direccion_establecimiento VARCHAR(500),
    codigo_establecimiento VARCHAR(3) NOT NULL DEFAULT '001',
    codigo_punto_emision VARCHAR(3) NOT NULL DEFAULT '001',
    obligado_contabilidad BOOLEAN NOT NULL DEFAULT false,
    contribuyente_especial_num VARCHAR(20),
    regimen_tributario VARCHAR(50) NOT NULL DEFAULT 'GENERAL', -- GENERAL, RIMPE_EMPRENDEDOR, RIMPE_NEGOCIO_POPULAR, AGENTE_RETENCION
    agente_retencion_num VARCHAR(20),
    ambiente_sri INT NOT NULL DEFAULT 1, -- 1: Pruebas, 2: Produccion
    tipo_emision INT NOT NULL DEFAULT 1, -- 1: Normal
    secuencial_factura INT NOT NULL DEFAULT 1,
    secuencial_nota_credito INT NOT NULL DEFAULT 1,
    certificado_p12_base64 TEXT,
    certificado_p12_password VARCHAR(200),
    certificado_caducidad TIMESTAMPTZ,
    certificado_nombre_archivo VARCHAR(200),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_sri_config_tenant_unique UNIQUE (tenant_id)
);

-- 2. Electronic Invoices Registry (SRI Ecuador)
CREATE TABLE IF NOT EXISTS electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    tipo_documento VARCHAR(2) NOT NULL DEFAULT '01', -- 01: Factura, 04: Nota de Credito
    establecimiento VARCHAR(3) NOT NULL DEFAULT '001',
    punto_emision VARCHAR(3) NOT NULL DEFAULT '001',
    secuencial VARCHAR(9) NOT NULL,
    numero_completo VARCHAR(17) NOT NULL, -- 001-001-000000001
    clave_acceso VARCHAR(49) NOT NULL UNIQUE,
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    ambiente INT NOT NULL DEFAULT 1,
    
    -- Buyer data
    cliente_tipo_id VARCHAR(2) NOT NULL DEFAULT '07', -- 04: RUC, 05: Cedula, 06: Pasaporte, 07: Consumidor Final, 08: Exterior
    cliente_identificacion VARCHAR(20) NOT NULL DEFAULT '9999999999999',
    cliente_razon_social VARCHAR(300) NOT NULL DEFAULT 'CONSUMIDOR FINAL',
    cliente_direccion VARCHAR(500),
    cliente_telefono VARCHAR(50),
    cliente_email VARCHAR(200),
    
    -- Monetary amounts
    subtotal_sin_impuestos NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    subtotal_15 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    subtotal_0 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    iva_15 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    propina NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    importe_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    forma_pago_sri VARCHAR(2) NOT NULL DEFAULT '01', -- 01: Sin sist. financiero, 16: Debito, 19: Credito, 20: Otros
    
    -- SRI Status
    estado_sri VARCHAR(30) NOT NULL DEFAULT 'GENERADA', -- GENERADA, FIRMADA, AUTORIZADA, NO_AUTORIZADA, DEVUELTA
    numero_autorizacion VARCHAR(49),
    fecha_autorizacion TIMESTAMPTZ,
    mensajes_sri JSONB NOT NULL DEFAULT '[]'::jsonb,
    xml_generado TEXT,
    xml_firmado TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_tenant ON electronic_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_sale ON electronic_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_clave ON electronic_invoices(clave_acceso);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_fecha ON electronic_invoices(fecha_emision DESC);

-- 3. Alter sales table for dual invoice emission and offline support
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_TICKET', -- INTERNAL_TICKET vs SRI_INVOICE
    ADD COLUMN IF NOT EXISTS electronic_invoice_id UUID REFERENCES electronic_invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS offline_folio VARCHAR(50); -- e.g. OFF-948123

CREATE INDEX IF NOT EXISTS idx_sales_invoice_type ON sales(invoice_type);
CREATE INDEX IF NOT EXISTS idx_sales_offline_folio ON sales(offline_folio);

-- 4. Seed default demo SRI config for tenant 1
INSERT INTO tenant_sri_config (
    tenant_id, ruc, razon_social, nombre_comercial, direccion_matriz, direccion_establecimiento,
    codigo_establecimiento, codigo_punto_emision, obligado_contabilidad, regimen_tributario,
    ambiente_sri, secuencial_factura, enabled
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '1790012345001',
    'FIXMETIENDAS ECUADOR S.A.S.',
    'FixmeTiendas Soluciones',
    'Av. Amazonas N24-196 y Luis Cordero, Edificio Titanium',
    'Av. Amazonas N24-196 Local 101',
    '001',
    '001',
    true,
    'RIMPE_EMPRENDEDOR',
    1, -- Pruebas
    1,
    true
)
ON CONFLICT (tenant_id) DO NOTHING;
