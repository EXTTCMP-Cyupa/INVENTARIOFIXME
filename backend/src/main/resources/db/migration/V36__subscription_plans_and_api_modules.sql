-- Migration V36: Subscription Plans and Modular Packages Architecture + APIS Module

-- 1. Extend tenant_modules constraint to include 'APIS'
ALTER TABLE tenant_modules DROP CONSTRAINT IF EXISTS tenant_modules_module_key_check;
ALTER TABLE tenant_modules ADD CONSTRAINT tenant_modules_module_key_check
  CHECK (module_key IN ('INVENTORY', 'POS', 'DELIVERIES', 'WORK_ORDERS', 'CUSTOMERS', 'REPORTS', 'CASH_REGISTER', 'QUOTES', 'APIS'));

-- 2. Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 49.00,
  included_modules TEXT[] NOT NULL DEFAULT ARRAY['INVENTORY','POS','CASH_REGISTER','CUSTOMERS','REPORTS'],
  features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  badge TEXT,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Populate default subscription plans
INSERT INTO subscription_plans (code, name, description, monthly_price, included_modules, features, badge, is_popular, is_active, display_order)
VALUES
(
  'STARTER',
  'Plan Básico / Inventario',
  'Ideal para microempresas que requieren control de stock, kardex y administración de clientes.',
  25.00,
  ARRAY['INVENTORY', 'CUSTOMERS', 'REPORTS'],
  ARRAY[
    'Control de inventario multicentro y almacenes',
    'Kardex y alertas automáticas de stock mínimo',
    'Cartera de clientes y CRM básico',
    'Reportes financieros y de movimientos',
    '1 Sucursal operativa incluida',
    'Soporte estándar vía correo'
  ],
  'INICIAL',
  false,
  true,
  1
),
(
  'PRO',
  'Plan Comercial / POS & Caja',
  'Solución completa para tiendas de retail, comercios y facturación en mostrador.',
  49.00,
  ARRAY['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'CUSTOMERS', 'REPORTS'],
  ARRAY[
    'Todo lo incluido en el Plan Básico',
    'Punto de Venta (POS) ultrarrápido con ticket 80mm',
    'Apertura, arqueos y cierres de caja (Corte Z)',
    'Facturación Electrónica SRI (Ecuador) autorizada',
    'Cotizaciones con enlace web y aprobación digital',
    'Múltiples formas de pago (Efectivo, Tarjeta, Transf.)',
    'Soporte prioritario por WhatsApp'
  ],
  'MÁS POPULAR',
  true,
  true,
  2
),
(
  'WORKSHOP',
  'Plan Taller & Servicio Técnico',
  'Diseñado para talleres de reparación de celulares, tecnología, motos y servicio técnico con tracking.',
  69.00,
  ARRAY['INVENTORY', 'POS', 'CASH_REGISTER', 'WORK_ORDERS', 'DELIVERIES', 'CUSTOMERS', 'REPORTS'],
  ARRAY[
    'Todo lo incluido en el Plan Comercial',
    'Módulo completo de Órdenes de Servicio Técnico',
    'Diagnóstico, checklist de recepción y trazabilidad de técnicos',
    'Portal público de seguimiento para clientes por código QR',
    'Aprobación online de presupuestos de reparación',
    'Gestión de despachos y entregas a domicilio (Delivery)',
    'Garantías comerciales con tracking digital'
  ],
  'TALLERES',
  false,
  true,
  3
),
(
  'ENTERPRISE',
  'Plan Enterprise / Full APIs & Pagos',
  'Acceso ilimitado a todos los módulos, pasarelas de cobro DeUna QR y Payphone, e integraciones API.',
  99.00,
  ARRAY['INVENTORY', 'POS', 'CASH_REGISTER', 'QUOTES', 'WORK_ORDERS', 'DELIVERIES', 'CUSTOMERS', 'REPORTS', 'APIS'],
  ARRAY[
    'Acceso total a todos los módulos del sistema',
    'Módulo Avanzado de APIs y Webhooks para desarrolladores',
    'Pasarela de cobro digital DeUna QR (Banco Pichincha)',
    'Pasarela de tarjetas de crédito/débito Payphone',
    'Catálogo digital interactivo con pedidos a WhatsApp',
    'Usuarios y sucursales ilimitadas',
    'Capacitación y soporte VIP 24/7'
  ],
  'TODO INCLUIDO',
  false,
  true,
  4
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    included_modules = EXCLUDED.included_modules,
    features = EXCLUDED.features,
    badge = EXCLUDED.badge,
    is_popular = EXCLUDED.is_popular,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = now();

-- 4. Seed 'APIS' module for all existing tenants (active for ENTERPRISE, inactive otherwise)
INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT t.id, 'APIS', CASE WHEN UPPER(COALESCE(t.plan, '')) = 'ENTERPRISE' THEN true ELSE false END
FROM tenants t
ON CONFLICT (tenant_id, module_key) DO NOTHING;

