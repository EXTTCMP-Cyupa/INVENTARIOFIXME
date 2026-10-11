-- Migration V45: Imports, Purchases/Kardex, Warranty Returns and Commissions

-- 1. Extend tenant_modules constraint to include 'IMPORTS', 'PURCHASES', 'WARRANTIES'
ALTER TABLE tenant_modules DROP CONSTRAINT IF EXISTS tenant_modules_module_key_check;
ALTER TABLE tenant_modules ADD CONSTRAINT tenant_modules_module_key_check
  CHECK (module_key IN (
    'INVENTORY', 'POS', 'DELIVERIES', 'WORK_ORDERS', 'CUSTOMERS',
    'REPORTS', 'CASH_REGISTER', 'QUOTES', 'APIS',
    'IMPORTS', 'PURCHASES', 'WARRANTIES'
  ));

-- Backfill new modules enabled for existing tenants
INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT DISTINCT t.id, m.key, true
FROM tenants t
CROSS JOIN (
  VALUES ('IMPORTS'), ('PURCHASES'), ('WARRANTIES')
) AS m(key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- 2. Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  tax_id TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_tenant_isolation ON suppliers;
CREATE POLICY suppliers_tenant_isolation ON suppliers USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 3. Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID REFERENCES branches(id),
  supplier_id UUID REFERENCES suppliers(id),
  invoice_number TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')),
  payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING', 'PARTIAL')),
  notes TEXT,
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchases_tenant_isolation ON purchases;
CREATE POLICY purchases_tenant_isolation ON purchases USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 4. Purchase Items table
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_tenant ON purchase_items(tenant_id);
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_items_tenant_isolation ON purchase_items;
CREATE POLICY purchase_items_tenant_isolation ON purchase_items USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 5. Extend inventory_movements for complete Kardex audit
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,4) DEFAULT 0.00;

-- 6. International Shipments (Courier & Bodega Miami / Arribos)
CREATE TABLE IF NOT EXISTS international_shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tracking_number TEXT NOT NULL,
  courier_name TEXT,
  origin_store TEXT,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'PURCHASED'
    CHECK (stage IN ('PURCHASED', 'WAREHOUSE_MIAMI', 'IN_TRANSIT', 'CUSTOMS', 'ARRIVED_LOCAL')),
  notes TEXT,
  weight_lbs NUMERIC(8,2) DEFAULT 0.00,
  origin_cost NUMERIC(12,2) DEFAULT 0.00,
  freight_cost NUMERIC(12,2) DEFAULT 0.00,
  customs_cost NUMERIC(12,2) DEFAULT 0.00,
  total_landed_cost NUMERIC(12,2) DEFAULT 0.00,
  estimated_arrival_date DATE,
  actual_arrival_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON international_shipments(tenant_id);
ALTER TABLE international_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE international_shipments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipments_tenant_isolation ON international_shipments;
CREATE POLICY shipments_tenant_isolation ON international_shipments USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 7. Import Items (Productos dentro del envío / Pre-Venta en Catálogo)
CREATE TABLE IF NOT EXISTS import_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  shipment_id UUID NOT NULL REFERENCES international_shipments(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  unit_origin_cost NUMERIC(12,2) DEFAULT 0.00,
  unit_freight_cost NUMERIC(12,2) DEFAULT 0.00,
  unit_customs_cost NUMERIC(12,2) DEFAULT 0.00,
  unit_landed_cost NUMERIC(12,2) DEFAULT 0.00,
  preorder_price NUMERIC(12,2) DEFAULT 0.00,
  regular_price NUMERIC(12,2) DEFAULT 0.00,
  image_url TEXT,
  is_public_catalog BOOLEAN NOT NULL DEFAULT true,
  target_category_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_items_tenant ON import_items(tenant_id);
ALTER TABLE import_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_items_tenant_isolation ON import_items;
CREATE POLICY import_items_tenant_isolation ON import_items USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 8. Customer Import Quote Requests (Cotizador de Encargos al Cliente)
CREATE TABLE IF NOT EXISTS import_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  product_description TEXT NOT NULL,
  product_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'ORDERED')),
  estimated_origin_price NUMERIC(12,2) DEFAULT 0.00,
  estimated_shipping_fee NUMERIC(12,2) DEFAULT 0.00,
  estimated_customs_fee NUMERIC(12,2) DEFAULT 0.00,
  total_quoted_price NUMERIC(12,2) DEFAULT 0.00,
  estimated_delivery_days INTEGER DEFAULT 10,
  seller_notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_quotes_tenant ON import_quotes(tenant_id);
ALTER TABLE import_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_quotes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_quotes_tenant_isolation ON import_quotes;
CREATE POLICY import_quotes_tenant_isolation ON import_quotes USING
  (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- 9. Warranty Returns & Technician Commissions in work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS parent_work_order_id UUID REFERENCES work_orders(id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_warranty_return BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS warranty_return_reason TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS technician_commission_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS technician_commission_amount NUMERIC(10,2) DEFAULT 0.00;

