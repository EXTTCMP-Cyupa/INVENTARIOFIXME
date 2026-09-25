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
      UUID assignedTechnicianId,
      Integer slaHours,
      List<OrderItemInput> items,
      String intakeChecklist,
      Boolean legalDisclaimerAccepted
  ) {
    public CreateOrderCommand(
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
        UUID assignedTechnicianId,
        Integer slaHours,
        List<OrderItemInput> items
    ) {
      this(customerId, branchId, deviceBrand, deviceModel, serialNumber, reportedFault,
           accessories, description, diagnosis, quote, estimatedDelivery, assignedTechnicianId,
           slaHours, items, "{}", true);
    }
  }

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

    int hours = cmd.slaHours() != null && cmd.slaHours() > 0 ? cmd.slaHours() : 48;
    OffsetDateTime now = OffsetDateTime.now();
    OffsetDateTime deadline = now.plusHours(hours);

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
        cmd.assignedTechnicianId(),
        hours,
        deadline,
        now,
        now
    );

    if (cmd.intakeChecklist() != null && !cmd.intakeChecklist().isBlank()) {
      order.setIntakeChecklist(cmd.intakeChecklist());
    }
    if (cmd.legalDisclaimerAccepted() != null) {
      order.setLegalDisclaimerAccepted(cmd.legalDisclaimerAccepted());
    }
    order.setItems(orderItems);
    return port.save(order);
  }

  public List<Map<String, Object>> listOrders(UUID tenantId, String status, String search, UUID technicianId) {
    modules.require(tenantId, "WORK_ORDERS");
    return port.listEnriched(tenantId, status, search, technicianId);
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
      OffsetDateTime estDelivery, UUID assignedTechnicianId, Integer slaHours, List<OrderItemInput> items
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

    order.updateTechnicalDetails(diagnosis, quote, techNotes, estDelivery, assignedTechnicianId, slaHours);
    port.update(order);
    return order;
  }

  public Optional<WorkOrder> findById(UUID tenantId, UUID orderId) {
    modules.require(tenantId, "WORK_ORDERS");
    return port.findById(tenantId, orderId);
  }

  public Optional<Map<String, Object>> getPublicTracking(UUID tenantId, String token) {
    String tokenHash = sha256(token);
    return port.findPublicTracking(tenantId, tokenHash);
  }

  public Map<String, Object> getPublicTracking(String rawToken) {
    if (rawToken == null || rawToken.isBlank()) {
      throw new IllegalArgumentException("Token de seguimiento requerido");
    }
    UUID tenantId;
    if (rawToken.contains(".")) {
      try {
        tenantId = UUID.fromString(rawToken.split("\\.")[0]);
      } catch (Exception e) {
        throw new IllegalArgumentException("Token de seguimiento inválido");
      }
    } else {
      throw new IllegalArgumentException("Formato de token no reconocido");
    }
    String tokenHash = sha256(rawToken);
    return port.findPublicTracking(tenantId, tokenHash)
        .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada o token expirado"));
  }

  public Map<String, Object> getPublicTrackingByCode(String code) {
    if (code == null || code.isBlank()) {
      throw new IllegalArgumentException("Código o token de orden requerido");
    }
    return port.findPublicTrackingByCode(code)
        .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada: " + code));
  }

  public Map<String, Object> respondToQuoteByCode(String code, boolean approved, String notes) {
    Map<String, Object> orderData = getPublicTrackingByCode(code);
    UUID tenantId = orderData.get("tenant_id") instanceof UUID u ? u : UUID.fromString(String.valueOf(orderData.get("tenant_id")));
    UUID orderId = orderData.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(orderData.get("id")));

    WorkOrder order = port.findById(tenantId, orderId)
        .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada"));

    if (approved) {
      order.approve(notes);
    } else {
      order.reject(notes);
    }
    port.update(order);

    return Map.of(
        "success", true,
        "status", order.getStatus(),
        "orderNumber", order.getOrderNumber() != null ? order.getOrderNumber() : "",
        "message", approved ? "Presupuesto aprobado exitosamente" : "Presupuesto rechazado"
    );
  }

  public Map<String, Object> respondToQuote(String rawToken, boolean approved, String notes) {
    if (rawToken == null || rawToken.isBlank()) {
      throw new IllegalArgumentException("Token requerido");
    }
    UUID tenantId;
    if (rawToken.contains(".")) {
      try {
        tenantId = UUID.fromString(rawToken.split("\\.")[0]);
      } catch (Exception e) {
        throw new IllegalArgumentException("Token inválido");
      }
    } else {
      throw new IllegalArgumentException("Formato de token no reconocido");
    }
    WorkOrder order = approved ? approveByCustomer(tenantId, rawToken, notes) : rejectByCustomer(tenantId, rawToken, notes);
    return Map.of(
        "success", true,
        "status", order.getStatus(),
        "orderNumber", order.getOrderNumber() != null ? order.getOrderNumber() : "",
        "message", approved ? "Presupuesto aprobado exitosamente" : "Presupuesto rechazado"
    );
  }

  public WorkOrder approveByCustomer(UUID tenantId, String token, String clientNotes) {
    String tokenHash = sha256(token);
    WorkOrder order = port.findByTokenHash(tenantId, tokenHash)
        .orElseThrow(() -> new IllegalArgumentException("Token de aprobación no válido o expirado"));
    order.approve(clientNotes);
    port.update(order);
    return order;
  }

  public WorkOrder rejectByCustomer(UUID tenantId, String token, String reason) {
    String tokenHash = sha256(token);
    WorkOrder order = port.findByTokenHash(tenantId, tokenHash)
        .orElseThrow(() -> new IllegalArgumentException("Token de aprobación no válido o expirado"));
    order.reject(reason);
    port.update(order);
    return order;
  }

  private String sha256(String base) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(base.getBytes(StandardCharsets.UTF_8));
      StringBuilder hexString = new StringBuilder();
      for (byte b : hash) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
      }
      return hexString.toString();
    } catch (Exception ex) {
      throw new RuntimeException("Error calculando SHA-256", ex);
    }
  }
}
