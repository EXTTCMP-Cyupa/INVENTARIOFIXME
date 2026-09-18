-- V24: Extend work orders status check constraint to support modern technician workflow statuses
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN (
    'OPEN', 'DIAGNOSIS', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
    'RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'WAITING_PARTS', 'LISTO_ENTREGA', 'ENTREGADO'
  ));

