/**
 * Fixme Tiendas - Tipos Centralizados para Órdenes de Trabajo (Work Orders)
 * Fuente única de verdad para estados, transiciones, SLAs y contratos de datos.
 */

export type WorkOrderStatus =
  | 'OPEN'
  | 'RECIBIDO'
  | 'DIAGNOSIS'
  | 'EN_DIAGNOSTICO'
  | 'COTIZADO'
  | 'QUOTED'
  | 'APROBADO'
  | 'APPROVED'
  | 'ESPERANDO_REPUESTOS'
  | 'WAITING_PARTS'
  | 'EN_REPARACION'
  | 'IN_PROGRESS'
  | 'TESTING'
  | 'EN_PRUEBAS'
  | 'PRUEBAS'
  | 'LISTO_ENTREGA'
  | 'COMPLETED'
  | 'ENTREGADO'
  | 'DELIVERED'
  | 'PAGADO'
  | 'CANCELLED'
  | 'REJECTED'
  | 'RECHAZADO'
  | 'CANCELADO';

export type SlaState = 'ok' | 'warning' | 'critical' | 'overdue' | 'archived_overdue';

export interface SlaInfo {
  state: SlaState;
  label: string;
  hoursLeft: number;
  isOverdue: boolean;
  isCritical: boolean;
}

export interface WorkOrderItem {
  id?: string;
  itemType: 'PART' | 'LABOR' | string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface WorkOrderImage {
  id?: string;
  stage: 'RECEPCION' | 'DIAGNOSTICO' | 'REPARACION' | 'FINALIZADO' | string;
  imageUrl?: string;
  image_url?: string;
  caption?: string;
  createdAt?: string;
  created_at?: string;
}

export interface WorkOrderCustomer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface WorkOrder {
  id: string;
  tenantId?: string;
  customerId?: string;
  branchId?: string;
  orderNumber: string;
  deviceBrand?: string;
  deviceModel?: string;
  serialNumber?: string;
  reportedFault?: string;
  accessories?: string;
  description?: string;
  diagnosis?: string;
  quote?: number;
  diagnosticFee?: number;
  status: WorkOrderStatus;
  approvalUrl?: string;
  approvalExpiresAt?: string;
  approvedAt?: string;
  technicianNotes?: string;
  clientNotes?: string;
  rejectionReason?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt?: string;
  assignedTechnicianId?: string;
  intakeChecklist?: string;
  legalDisclaimerAccepted?: boolean;
  slaDeadline?: string;
  slaHours?: number;

  // Campos enriquecidos (joins)
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  branchName?: string;
  technicianName?: string;
  technicianPhone?: string;

  // Sub-recursos cargados en lote
  items?: WorkOrderItem[];
  images?: WorkOrderImage[];
}

export interface OrdersCounts {
  total: number;
  open: number;
  diagnosis: number;
  quoted: number;
  waiting_parts: number;
  repair: number;
  testing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  slaOverdue: number;
  slaCritical: number;
  [key: string]: number;
}

export interface OrderFilterParams {
  status?: string;
  search?: string;
  q?: string;
  technicianId?: string;
  sla?: 'overdue' | 'critical' | 'ok';
  from?: string;
  to?: string;
  sort?: 'created_desc' | 'created_asc' | 'sla_asc' | 'updated_desc' | string;
  limit?: number;
  cursor?: string;
  paged?: boolean;
}

export interface PagedOrdersResponse<T = WorkOrder> {
  data: T[];
  nextCursor?: string | null;
  hasMore: boolean;
  total: number;
}

/**
 * Metadata canónica de estados de taller para el Kanban y badges
 */
export interface WorkshopStageMeta {
  code: string;
  label: string;
  step: number;
  color: string;
  bgLight: string;
  borderColor: string;
  primaryAction?: {
    label: string;
    nextStatus: string;
    techNotesPlaceholder: string;
  };
}

export const WORKSHOP_STAGES: Record<string, WorkshopStageMeta> = {
  OPEN: {
    code: 'OPEN',
    label: 'Recepción',
    step: 1,
    color: '#0284c7',
    bgLight: '#f0f9ff',
    borderColor: '#bae6fd',
    primaryAction: {
      label: '🔍 Iniciar Diagnóstico',
      nextStatus: 'DIAGNOSIS',
      techNotesPlaceholder: 'Desarme y pruebas iniciales en banco...'
    }
  },
  DIAGNOSIS: {
    code: 'DIAGNOSIS',
    label: 'Diagnóstico',
    step: 2,
    color: '#7c3aed',
    bgLight: '#f5f3ff',
    borderColor: '#ddd6fe',
    primaryAction: {
      label: '💰 Fijar Cotización',
      nextStatus: 'COTIZADO',
      techNotesPlaceholder: 'Diagnóstico completado. Requiere cambio de...'
    }
  },
  COTIZADO: {
    code: 'COTIZADO',
    label: 'Cotizada / Aprobación',
    step: 3,
    color: '#ea580c',
    bgLight: '#fff7ed',
    borderColor: '#fed7aa',
    primaryAction: {
      label: '👍 Autorizar Presupuesto',
      nextStatus: 'EN_REPARACION',
      techNotesPlaceholder: 'Cliente aprueba presupuesto vía llamada/WhatsApp...'
    }
  },
  ESPERANDO_REPUESTOS: {
    code: 'ESPERANDO_REPUESTOS',
    label: 'Esperando Repuestos',
    step: 4,
    color: '#b45309',
    bgLight: '#fefce8',
    borderColor: '#fef08a',
    primaryAction: {
      label: '⚙️ Iniciar Reparación',
      nextStatus: 'EN_REPARACION',
      techNotesPlaceholder: 'Repuestos recibidos en taller, se inicia ensamble...'
    }
  },
  EN_REPARACION: {
    code: 'EN_REPARACION',
    label: 'En Reparación',
    step: 5,
    color: '#2563eb',
    bgLight: '#eff6ff',
    borderColor: '#bfdbfe',
    primaryAction: {
      label: '🧪 Pasar a Pruebas',
      nextStatus: 'TESTING',
      techNotesPlaceholder: 'Reparación culminada. En pruebas de carga y sensores...'
    }
  },
  TESTING: {
    code: 'TESTING',
    label: 'Pruebas / QA',
    step: 6,
    color: '#0891b2',
    bgLight: '#ecfeff',
    borderColor: '#a5f3fc',
    primaryAction: {
      label: '✅ Marcar Listo Retiro',
      nextStatus: 'LISTO_ENTREGA',
      techNotesPlaceholder: 'Equipo superó todas las pruebas de calidad...'
    }
  },
  LISTO_ENTREGA: {
    code: 'LISTO_ENTREGA',
    label: 'Listo para Entrega',
    step: 7,
    color: '#16a34a',
    bgLight: '#f0fdf4',
    borderColor: '#bbf7d0',
    primaryAction: {
      label: '🤝 Cobrar y Entregar',
      nextStatus: 'DELIVERED',
      techNotesPlaceholder: 'Entregado a entera satisfacción del cliente...'
    }
  },
  DELIVERED: {
    code: 'DELIVERED',
    label: 'Entregado / Pagado',
    step: 8,
    color: '#475569',
    bgLight: '#f8fafc',
    borderColor: '#e2e8f0'
  }
};

