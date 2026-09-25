-- V38: Repair Marketplace (Customer Requests, Photo Uploads, Workshop Bidding, and Work Order Warranty/Payment Tracking)

-- 1. Customer Repair Requests
CREATE TABLE IF NOT EXISTS repair_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    city TEXT NOT NULL,
    neighborhood TEXT,
    customer_address TEXT,
    delivery_preference TEXT NOT NULL DEFAULT 'WORKSHOP', -- 'WORKSHOP', 'HOME_PICKUP', 'HOME_SERVICE'
    device_category TEXT NOT NULL DEFAULT 'SMARTPHONE',   -- 'SMARTPHONE', 'LAPTOP', 'TABLET', 'CONSOLE', 'DESKTOP', 'SMARTWATCH', 'OTHER'
    device_brand TEXT NOT NULL,
    device_model TEXT NOT NULL,
    powers_on BOOLEAN DEFAULT true,
    fault_description TEXT NOT NULL,
    urgency TEXT DEFAULT 'NORMAL',                        -- 'LOW', 'NORMAL', 'URGENT'
    status TEXT NOT NULL DEFAULT 'OPEN',                  -- 'OPEN', 'QUOTED', 'ACCEPTED', 'CANCELLED', 'COMPLETED'
    selected_bid_id UUID,
    selected_tenant_id UUID REFERENCES tenants(id),
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Customer Request Images (Photos of the fault/damage)
CREATE TABLE IF NOT EXISTS repair_request_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Workshop Bids / Quotes for Customer Requests
CREATE TABLE IF NOT EXISTS repair_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES app_users(id),
    estimated_cost NUMERIC(12,2) NOT NULL,
    estimated_time TEXT NOT NULL,
    warranty_terms TEXT,
    spare_part_quality TEXT,
    proposal_notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',               -- 'PENDING', 'ACCEPTED', 'REJECTED'
    converted_work_order_id UUID REFERENCES work_orders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key back to repair_bids for selected_bid_id
ALTER TABLE repair_requests DROP CONSTRAINT IF EXISTS fk_repair_requests_selected_bid;
ALTER TABLE repair_requests
    ADD CONSTRAINT fk_repair_requests_selected_bid
    FOREIGN KEY (selected_bid_id) REFERENCES repair_bids(id) ON DELETE SET NULL;

-- 4. Indexes for fast marketplace searches
CREATE INDEX IF NOT EXISTS idx_repair_requests_status ON repair_requests(status);
CREATE INDEX IF NOT EXISTS idx_repair_requests_city ON repair_requests(city);
CREATE INDEX IF NOT EXISTS idx_repair_requests_code ON repair_requests(request_code);
CREATE INDEX IF NOT EXISTS idx_repair_requests_token ON repair_requests(access_token);
CREATE INDEX IF NOT EXISTS idx_repair_request_images_req ON repair_request_images(request_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_req ON repair_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_tenant ON repair_bids(tenant_id);

-- 5. Adapt warranties table to support service/work-order warranties (product_id optional)
ALTER TABLE warranties ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS service_description TEXT;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS warranty_days INTEGER;

-- 6. Enhance work_orders table with Payment Method and Warranty Tracking
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 30;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS warranty_terms TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS warranty_id UUID REFERENCES warranties(id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS origin_marketplace_request_id UUID REFERENCES repair_requests(id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'WORKSHOP';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (status = ANY (ARRAY['OPEN', 'DIAGNOSIS', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'WAITING_PARTS', 'LISTO_ENTREGA', 'ENTREGADO', 'DELIVERED']));

-- 7. Seed initial demo repair requests so the marketplace has active leads
INSERT INTO repair_requests (
    id, request_code, customer_name, customer_phone, customer_email,
    city, neighborhood, customer_address, delivery_preference,
    device_category, device_brand, device_model, powers_on,
    fault_description, urgency, status, access_token, created_at
) VALUES
(
    'a1111111-1111-1111-1111-111111111101', 'SOL-2026-101', 'Mateo Morales', '0998765432', 'mateo.morales@gmail.com',
    'Quito', 'La Carolina', 'Av. República del Salvador y Moscú', 'WORKSHOP',
    'SMARTPHONE', 'Apple', 'iPhone 13 Pro', true,
    'Pantalla con rayas verticales verdes tras caída accidental. El táctil responde solo en la mitad inferior. Requiere cambio de pantalla urgente.',
    'URGENT', 'OPEN', 'tok_demo_req_101', now() - interval '2 hours'
),
(
    'a1111111-1111-1111-1111-111111111102', 'SOL-2026-102', 'Valeria Cárdenas', '0984561234', 'valeria.c@hotmail.com',
    'Quito', 'Cumbayá', 'Calle Francisco de Orellana 450', 'HOME_PICKUP',
    'LAPTOP', 'Apple', 'MacBook Air M1 (2020)', false,
    'Se derramó café sobre el teclado. Se apagó de inmediato y no volvió a encender ni con el cargador. Necesito diagnóstico de placa y limpieza ultrasónica.',
    'NORMAL', 'OPEN', 'tok_demo_req_102', now() - interval '5 hours'
),
(
    'a1111111-1111-1111-1111-111111111103', 'SOL-2026-103', 'Carlos Enríquez', '0971239874', 'carlos.enriquez@yahoo.com',
    'Quito', 'Chillogallo', 'Av. Mariscal Sucre y Morán Valverde', 'WORKSHOP',
    'SMARTPHONE', 'Samsung', 'Galaxy S22 Ultra', true,
    'El puerto de carga USB-C está flojo y no detecta el cable o carga de forma intermitente. La batería también se descarga rápido.',
    'NORMAL', 'OPEN', 'tok_demo_req_103', now() - interval '8 hours'
),
(
    'a1111111-1111-1111-1111-111111111104', 'SOL-2026-104', 'Diego Armijos', '0963321144', 'diego.armijos@outlook.com',
    'Quito', 'El Batán', 'Gaspar de Villarroel y Shyris', 'HOME_SERVICE',
    'CONSOLE', 'Sony', 'PlayStation 5', true,
    'Se sobrecalienta a los 15 minutos de juego y se apaga automáticamente con luz roja. Suena mucho el ventilador. Requiere cambio de metal líquido y mantenimiento.',
    'NORMAL', 'OPEN', 'tok_demo_req_104', now() - interval '1 day'
)
ON CONFLICT (request_code) DO NOTHING;

-- Seed demo images for the requests (clean SVG data URLs so they always render beautifully without external dependencies)
INSERT INTO repair_request_images (id, request_id, image_url, file_name) VALUES
(
    uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111101',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><rect x="70" y="20" width="260" height="260" rx="20" fill="%230f172a" stroke="%2338bdf8" stroke-width="3"/><line x1="80" y1="50" x2="320" y2="250" stroke="%23ef4444" stroke-width="4" stroke-dasharray="5,5"/><line x1="120" y1="30" x2="280" y2="270" stroke="%2322c55e" stroke-width="3"/><text x="200" y="150" fill="%23f8fafc" font-size="16" font-family="sans-serif" text-anchor="middle">📱 Pantalla rota con líneas verdes</text></svg>',
    'iphone13_falla_pantalla.svg'
),
(
    uuid_generate_v4(), 'a1111111-1111-1111-1111-111111111102',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><rect x="40" y="40" width="320" height="200" rx="10" fill="%23334155" stroke="%2394a3b8" stroke-width="2"/><circle cx="200" cy="130" r="45" fill="%2378350f" opacity="0.6"/><text x="200" y="135" fill="%23fef08a" font-size="15" font-family="sans-serif" text-anchor="middle">☕ Daño por líquido en teclado</text></svg>',
    'macbook_liquido.svg'
)
ON CONFLICT DO NOTHING;
