package com.fixme.application;

import com.fixme.domain.WorkOrder;
import com.fixme.domain.WorkOrderItem;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface WorkOrderPort {
  WorkOrder save(WorkOrder order);
  void update(WorkOrder order);
  Optional<WorkOrder> findById(UUID tenantId, UUID orderId);
  Optional<WorkOrder> findByTokenHash(UUID tenantId, String tokenHash);
  List<Map<String, Object>> listEnriched(UUID tenantId, String statusFilter, String search);
  Optional<Map<String, Object>> findPublicTracking(UUID tenantId, String tokenHash);
  String generateNextOrderNumber(UUID tenantId);
  List<WorkOrderItem> findItemsByOrderId(UUID tenantId, UUID orderId);
  void saveItems(UUID tenantId, UUID orderId, List<WorkOrderItem> items);
}
