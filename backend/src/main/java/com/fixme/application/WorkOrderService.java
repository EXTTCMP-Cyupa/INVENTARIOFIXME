package com.fixme.application;

import com.fixme.domain.WorkOrder;
import com.fixme.domain.WorkOrderItem;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class WorkOrderService {
  private final WorkOrderPort port;
  private final ModuleService modules;

  public WorkOrderService(WorkOrderPort port, ModuleService modules) {
    this.port = port;
    this.modules = modules;
  }

  public record OrderItemInput(
      String itemType,
      String name,
      BigDecimal quantity,
      BigDecimal unitPrice
  ) {}

  public record CreateOrderCommand(
      UUID customerId,
      UUID branchId,
      String deviceBrand,
      String deviceModel,
      String serialNumber,
      String reportedFault,
      String accessories,
      String description,
      String diagnosis,
      BigDecimal quote,
      OffsetDateTime estimatedDelivery,
      List<OrderItemInput> items
  ) {}

  public WorkOrder createOrder(UUID tenantId, CreateOrderCommand cmd) {
    modules.require(tenantId, "WORK_ORDERS");
    Objects.requireNonNull(cmd.customerId(), "El cliente es obligatorio");

    String rawToken = tenantId + "." + UUID.randomUUID();
    String tokenHash = sha256(rawToken);
    OffsetDateTime expiresAt = OffsetDateTime.now().plusDays(15);
    String publicUrl = "/public/work-orders/approve?token=" + rawToken;
    String orderNumber = port.generateNextOrderNumber(tenantId);

    String fullDesc = (cmd.description() != null && !cmd.description().isBlank())
        ? cmd.description()
        : (String.valueOf(cmd.deviceBrand() != null ? cmd.deviceBrand() : "") + " " +
           String.valueOf(cmd.deviceModel() != null ? cmd.deviceModel() : "")).trim();
    if (fullDesc.isBlank()) {
      fullDesc = "Servicio técnico";
    }

    UUID orderId = UUID.randomUUID();
    List<WorkOrderItem> orderItems = new ArrayList<>();
    BigDecimal calculatedQuote = cmd.quote() != null ? cmd.quote() : BigDecimal.ZERO;

    if (cmd.items() != null && !cmd.items().isEmpty()) {
      calculatedQuote = BigDecimal.ZERO;
      for (OrderItemInput it : cmd.items()) {
        if (it.name() != null && !it.name().isBlank()) {
          BigDecimal qty = it.quantity() != null && it.quantity().compareTo(BigDecimal.ZERO) > 0 ? it.quantity() : BigDecimal.ONE;
          BigDecimal price = it.unitPrice() != null && it.unitPrice().compareTo(BigDecimal.ZERO) >= 0 ? it.unitPrice() : BigDecimal.ZERO;
          BigDecimal sub = qty.multiply(price);
          calculatedQuote = calculatedQuote.add(sub);
          orderItems.add(new WorkOrderItem(
              UUID.randomUUID(), tenantId, orderId, it.itemType(),
              it.name(), qty, price, sub, OffsetDateTime.now()
          ));
        }
      }
    }

    WorkOrder order = new WorkOrder(
        orderId,
        tenantId,
        cmd.customerId(),
        cmd.branchId(),
        orderNumber,
        cmd.deviceBrand(),
        cmd.deviceModel(),
        cmd.serialNumber(),
        cmd.reportedFault(),
        cmd.accessories(),
        fullDesc,
        cmd.diagnosis(),
        calculatedQuote,
        (calculatedQuote.compareTo(BigDecimal.ZERO) > 0) ? "QUOTED" : "OPEN",
        tokenHash,
        expiresAt,
        null,
        publicUrl,
        null,
        null,
        null,
        cmd.estimatedDelivery(),
        OffsetDateTime.now(),
        OffsetDateTime.now()
    );

    order.setItems(orderItems);
    return port.save(order);
  }

  public List<Map<String, Object>> listOrders(UUID tenantId, String status, String search) {
    modules.require(tenantId, "WORK_ORDERS");
    return port.listEnriched(tenantId, status, search);
  }

  public WorkOrder updateStatus(UUID tenantId, UUID orderId, String newStatus, String techNotes) {
    modules.require(tenantId, "WORK_ORDERS");
    WorkOrder order = port.findById(tenantId, orderId)
        .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada: " + orderId));
    order.updateStatus(newStatus, techNotes);
    port.update(order);
    return order;
  }

  public WorkOrder updateTechnicalDetails(
      UUID tenantId, UUID orderId, String diagnosis, BigDecimal quote, String techNotes,
      OffsetDateTime estDelivery, List<OrderItemInput> items
  ) {
    modules.require(tenantId, "WORK_ORDERS");
    WorkOrder order = port.findById(tenantId, orderId)
        .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada: " + orderId));

    if (items != null) {
      List<WorkOrderItem> newItems = new ArrayList<>();
      BigDecimal total = BigDecimal.ZERO;
      for (OrderItemInput it : items) {
        if (it.name() != null && !it.name().isBlank()) {
          BigDecimal qty = it.quantity() != null && it.quantity().compareTo(BigDecimal.ZERO) > 0 ? it.quantity() : BigDecimal.ONE;
          BigDecimal price = it.unitPrice() != null && it.unitPrice().compareTo(BigDecimal.ZERO) >= 0 ? it.unitPrice() : BigDecimal.ZERO;
          BigDecimal sub = qty.multiply(price);
          total = total.add(sub);
          newItems.add(new WorkOrderItem(
              UUID.randomUUID(), tenantId, orderId, it.itemType(),
              it.name(), qty, price, sub, OffsetDateTime.now()
          ));
        }
      }
      order.setItems(newItems);
      quote = total;
    }

    order.updateDiagnosisAndQuote(diagnosis, quote, techNotes, estDelivery);
    port.update(order);
    return order;
  }

  public Map<String, Object> getPublicTracking(String rawToken) {
    String[] parts = parseToken(rawToken);
    UUID tenantId = UUID.fromString(parts[0]);
    String hash = sha256(rawToken);

    return port.findPublicTracking(tenantId, hash)
        .orElseThrow(() -> new NoSuchElementException("Orden de servicio no encontrada o token inválido"));
  }

  public Map<String, Object> respondToQuote(String rawToken, boolean accepted, String comments) {
    String[] parts = parseToken(rawToken);
    UUID tenantId = UUID.fromString(parts[0]);
    String hash = sha256(rawToken);

    WorkOrder order = port.findByTokenHash(tenantId, hash)
        .orElseThrow(() -> new NoSuchElementException("Orden no encontrada o token inválido"));

    if (accepted) {
      order.approve(comments != null ? comments.trim() : null);
    } else {
      order.reject(comments != null ? comments.trim() : "Rechazado por el cliente");
    }

    port.update(order);

    return Map.of(
        "success", true,
        "status", order.getStatus(),
        "message", accepted ? "¡Cotización aprobada con éxito!" : "Has rechazado la cotización."
    );
  }

  public static String sha256(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Error al calcular hash", e);
    }
  }

  private String[] parseToken(String rawToken) {
    if (rawToken == null || !rawToken.contains(".")) {
      throw new IllegalArgumentException("Formato de token de seguimiento inválido");
    }
    String[] parts = rawToken.split("\\.", 2);
    if (parts.length != 2) {
      throw new IllegalArgumentException("Token inválido");
    }
    return parts;
  }
}
