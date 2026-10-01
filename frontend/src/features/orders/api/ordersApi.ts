/**
 * Fixme Tiendas - API de Órdenes de Trabajo (Work Orders)
 * Funciones tipadas para consultar listados paginados por cursor, conteos de estados y transiciones.
 */

import { apiClient } from '../../../shared/lib/apiClient';
import type {
  WorkOrder,
  OrdersCounts,
  OrderFilterParams,
  PagedOrdersResponse
} from '../types';

/**
 * Consulta órdenes de trabajo con paginación por cursor, filtros y SLAs
 */
export async function fetchOrders(params: OrderFilterParams = {}): Promise<PagedOrdersResponse<WorkOrder>> {
  const queryParams: Record<string, string | number | boolean | undefined> = {
    ...params,
    paged: true
  };

  const response = await apiClient<PagedOrdersResponse<WorkOrder> | WorkOrder[]>('/api/orders', {
    params: queryParams
  });

  // Compatibilidad: si el servidor retorna un array crudo, adaptarlo al formato paginado
  if (Array.isArray(response)) {
    return {
      data: response,
      nextCursor: null,
      hasMore: false,
      total: response.length
    };
  }

  return response;
}

/**
 * Consulta conteos de órdenes agrupados por estado y alertas de SLA en una sola consulta
 */
export async function fetchOrderCounts(params: {
  technicianId?: string;
  search?: string;
  q?: string;
  from?: string;
  to?: string;
} = {}): Promise<OrdersCounts> {
  const res = await apiClient<OrdersCounts>('/api/orders/counts', {
    params
  });

  return {
    ...res,
    total: res.total || 0,
    open: res.open || res.OPEN || 0,
    diagnosis: res.diagnosis || res.DIAGNOSIS || 0,
    quoted: res.quoted || res.COTIZADO || 0,
    waiting_parts: res.waiting_parts || res.waitingParts || res.ESPERANDO_REPUESTOS || 0,
    repair: res.repair || res.EN_REPARACION || 0,
    testing: res.testing || res.TESTING || 0,
    ready: res.ready || res.LISTO_ENTREGA || 0,
    delivered: res.delivered || res.DELIVERED || 0,
    cancelled: res.cancelled || res.CANCELLED || 0,
    slaOverdue: res.slaOverdue || res.sla_overdue || 0,
    slaCritical: res.slaCritical || res.sla_critical || 0
  };
}

/**
 * Actualiza el estado de una orden de trabajo (validando transiciones en servidor)
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  notes?: string
): Promise<{ success: boolean; status: string; message?: string }> {
  return await apiClient(`/api/work-orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: newStatus,
      techNotes: notes || ''
    })
  });
}

/**
 * Obtiene el detalle completo de una orden de trabajo por ID
 */
export async function fetchOrderDetails(orderId: string): Promise<WorkOrder> {
  return await apiClient<WorkOrder>(`/api/work-orders/${orderId}`);
}
