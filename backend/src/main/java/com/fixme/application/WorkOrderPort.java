package com.fixme.application;

import com.fixme.domain.WorkOrder;
import com.fixme.domain.WorkOrderItem;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface WorkOrderPort {
  record WorkOrderQueryParams(
      String status,
      String search,
      UUID technicianId,
      Boolean unassignedOnly,
      String sla,
      String from,
      String to,
      String sort,
      Integer limit,
      String cursor
  ) {}

  record PagedOrdersResult(
      List<Map<String, Object>> data,
      String nextCursor,
      boolean hasMore,
      long total
  ) {}

  WorkOrder save(WorkOrder order);
  void update(WorkOrder order);
  Optional<WorkOrder> findById(UUID tenantId, UUID orderId);
  Optional<WorkOrder> findByTokenHash(UUID tenantId, String tokenHash);
  List<Map<String, Object>> listEnriched(UUID tenantId, String statusFilter, String search, UUID technicianId);
  PagedOrdersResult listEnrichedPaged(UUID tenantId, WorkOrderQueryParams query);
  Map<String, Object> countOrdersByStatus(UUID tenantId, UUID technicianId, String search, String from, String to);
  Optional<Map<String, Object>> findPublicTracking(UUID tenantId, String tokenHash);
  Optional<Map<String, Object>> findPublicTrackingByCode(String code);
  String generateNextOrderNumber(UUID tenantId);
  List<WorkOrderItem> findItemsByOrderId(UUID tenantId, UUID orderId);
  void saveItems(UUID tenantId, UUID orderId, List<WorkOrderItem> items);
}
