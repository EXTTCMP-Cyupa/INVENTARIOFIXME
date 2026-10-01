-- Migration V42: Work Order Diagnostic Fee & Extended Workshop Flow Statuses (Quoted, Approved, Testing, Delivered, Paid)

-- 1. Añadir tarifa o valor de diagnóstico a la orden de trabajo
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS diagnostic_fee NUMERIC(12,2) DEFAULT 0.00;

-- 2. Ampliar el check constraint de estados para cubrir todo el ciclo técnico de taller:
-- Recepción -> Diagnóstico -> Cotizado -> Aprobado / Rechazado -> Esperando Repuestos -> Pruebas -> Listo para entrega -> Pagado / Entregado
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN (
    'OPEN', 'DIAGNOSIS', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
    'RECIBIDO', 'EN_DIAGNOSTICO', 'COTIZADO', 'APROBADO', 'RECHAZADO', 'CANCELADO',
    'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'WAITING_PARTS',
    'TESTING', 'EN_PRUEBAS', 'PRUEBAS',
    'LISTO_ENTREGA', 'ENTREGADO', 'DELIVERED', 'PAGADO'
  ));

