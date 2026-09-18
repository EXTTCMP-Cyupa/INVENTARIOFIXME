package com.fixme.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

public class WorkOrderItem {
  private final UUID id;
  private final UUID tenantId;
  private final UUID workOrderId;
  private String itemType;
  private String name;
  private BigDecimal quantity;
  private BigDecimal unitPrice;
  private BigDecimal subtotal;
  private final OffsetDateTime createdAt;

  public WorkOrderItem(
      UUID id, UUID tenantId, UUID workOrderId, String itemType,
      String name, BigDecimal quantity, BigDecimal unitPrice,
      BigDecimal subtotal, OffsetDateTime createdAt
  ) {
    this.id = Objects.requireNonNull(id, "ID es requerido");
    this.tenantId = Objects.requireNonNull(tenantId, "Tenant ID es requerido");
    this.workOrderId = Objects.requireNonNull(workOrderId, "Work Order ID es requerido");
    this.itemType = (itemType != null && !itemType.isBlank()) ? itemType.toUpperCase() : "SERVICE";
    this.name = Objects.requireNonNull(name, "Nombre del ítem es requerido").trim();
    this.quantity = (quantity != null && quantity.compareTo(BigDecimal.ZERO) > 0) ? quantity : BigDecimal.ONE;
    this.unitPrice = (unitPrice != null && unitPrice.compareTo(BigDecimal.ZERO) >= 0) ? unitPrice : BigDecimal.ZERO;
    this.subtotal = (subtotal != null && subtotal.compareTo(BigDecimal.ZERO) >= 0)
        ? subtotal
        : this.quantity.multiply(this.unitPrice);
    this.createdAt = createdAt != null ? createdAt : OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getTenantId() { return tenantId; }
  public UUID getWorkOrderId() { return workOrderId; }
  public String getItemType() { return itemType; }
  public String getName() { return name; }
  public BigDecimal getQuantity() { return quantity; }
  public BigDecimal getUnitPrice() { return unitPrice; }
  public BigDecimal getSubtotal() { return subtotal; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}

