-- Migration V41: Trust-Cam Visual Diagnosis, Intake Checklist & Repair Notification Model

-- 1. Trust-Cam: Fotos de Recepción, Diagnóstico y Entrega en Órdenes de Trabajo
CREATE TABLE IF NOT EXISTS work_order_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    stage VARCHAR(30) NOT NULL DEFAULT 'DIAGNOSIS',
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_images_wo_stage ON work_order_images(work_order_id, stage);

-- 2. Checklist Técnico de Ingreso y Aceptación Legal en work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS intake_checklist JSONB DEFAULT '{}'::jsonb;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS legal_disclaimer_accepted BOOLEAN DEFAULT true;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_signature TEXT;

-- 3. Modelo de Notificaciones para Clientes (WhatsApp, SMS, Email)
CREATE TABLE IF NOT EXISTS repair_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    notification_type VARCHAR(50) NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    recipient_name VARCHAR(150),
    message_payload TEXT NOT NULL,
    portal_link TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_notifications_tenant_wo ON repair_notifications(tenant_id, work_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_notifications_phone ON repair_notifications(recipient_phone, status);

