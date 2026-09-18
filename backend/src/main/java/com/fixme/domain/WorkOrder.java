package com.fixme.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public class WorkOrder {
  private final UUID id;
  private final UUID tenantId;
  private final UUID customerId;
  private UUID branchId;
  private String orderNumber;
  private String deviceBrand;
  private String deviceModel;
  private String serialNumber;
  private String reportedFault;
  private String accessories;
  private String description;
  private String diagnosis;
  private BigDecimal quote;
  private String status;
  private String approvalTokenHash;
  private OffsetDateTime approvalExpiresAt;
  private OffsetDateTime approvedAt;
  private String approvalUrl;
  private String technicianNotes;
  private String clientNotes;
  private String rejectionReason;
  private OffsetDateTime estimatedDelivery;
  private UUID assignedTechnicianId;
  private int slaHours = 48;
  private OffsetDateTime slaDeadline;
  private final OffsetDateTime createdAt;
  private OffsetDateTime updatedAt;
  private List<WorkOrderItem> items = new ArrayList<>();

  public static final Set<String> VALID_STATUSES = Set.of(
      "OPEN", "DIAGNOSIS", "QUOTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
  );

  public WorkOrder(
      UUID id, UUID tenantId, UUID customerId, UUID branchId, String orderNumber,
      String deviceBrand, String deviceModel, String serialNumber, String reportedFault,
      String accessories, String description, String diagnosis, BigDecimal quote,
      String status, String approvalTokenHash, OffsetDateTime approvalExpiresAt,
      OffsetDateTime approvedAt, String approvalUrl, String technicianNotes,
      String clientNotes, String rejectionReason, OffsetDateTime estimatedDelivery,
      OffsetDateTime createdAt, OffsetDateTime updatedAt
  ) {
    this(id, tenantId, customerId, branchId, orderNumber, deviceBrand, deviceModel, serialNumber,
         reportedFault, accessories, description, diagnosis, quote, status, approvalTokenHash,
         approvalExpiresAt, approvedAt, approvalUrl, technicianNotes, clientNotes, rejectionReason,
         estimatedDelivery, null, 48, null, createdAt, updatedAt);
  }

  public WorkOrder(
      UUID id, UUID tenantId, UUID customerId, UUID branchId, String orderNumber,
      String deviceBrand, String deviceModel, String serialNumber, String reportedFault,
      String accessories, String description, String diagnosis, BigDecimal quote,
      String status, String approvalTokenHash, OffsetDateTime approvalExpiresAt,
      OffsetDateTime approvedAt, String approvalUrl, String technicianNotes,
      String clientNotes, String rejectionReason, OffsetDateTime estimatedDelivery,
      UUID assignedTechnicianId, Integer slaHours, OffsetDateTime slaDeadline,
      OffsetDateTime createdAt, OffsetDateTime updatedAt
  ) {
    this.id = Objects.requireNonNull(id, "ID es requerido");
    this.tenantId = Objects.requireNonNull(tenantId, "Tenant ID es requerido");
    this.customerId = Objects.requireNonNull(customerId, "Cliente ID es requerido");
    this.branchId = branchId;
    this.orderNumber = orderNumber;
    this.deviceBrand = deviceBrand;
    this.deviceModel = deviceModel;
    this.serialNumber = serialNumber;
    this.reportedFault = reportedFault;
    this.accessories = accessories;
    this.description = description != null ? description : (deviceBrand + " " + deviceModel).trim();
    this.diagnosis = diagnosis;
    this.quote = quote != null && quote.compareTo(BigDecimal.ZERO) >= 0 ? quote : BigDecimal.ZERO;
    this.status = status != null && VALID_STATUSES.contains(status) ? status : "OPEN";
    this.approvalTokenHash = approvalTokenHash;
    this.approvalExpiresAt = approvalExpiresAt;
    this.approvedAt = approvedAt;
    this.approvalUrl = approvalUrl;
    this.technicianNotes = technicianNotes;
    this.clientNotes = clientNotes;
    this.rejectionReason = rejectionReason;
    this.estimatedDelivery = estimatedDelivery;
    this.assignedTechnicianId = assignedTechnicianId;
    this.slaHours = slaHours != null && slaHours > 0 ? slaHours : 48;
    this.createdAt = createdAt != null ? createdAt : OffsetDateTime.now();
    this.slaDeadline = slaDeadline != null ? slaDeadline : this.createdAt.plusHours(this.slaHours);
    this.updatedAt = updatedAt != null ? updatedAt : OffsetDateTime.now();
  }

  public boolean isApprovalActive() {
    return (approvalExpiresAt == null || approvalExpiresAt.isAfter(OffsetDateTime.now()))
        && Set.of("OPEN", "DIAGNOSIS", "QUOTED").contains(status);
  }

  public void approve(String clientNotes) {
    if (!isApprovalActive()) {
      throw new IllegalStateException("La cotización no está disponible para aprobación o ha expirado");
    }
    this.status = "APPROVED";
    this.approvedAt = OffsetDateTime.now();
    this.clientNotes = clientNotes;
    this.updatedAt = OffsetDateTime.now();
  }

  public void reject(String reason) {
    if (!isApprovalActive()) {
      throw new IllegalStateException("La cotización no está disponible para rechazo o ha expirado");
    }
    this.status = "REJECTED";
    this.rejectionReason = reason;
    this.updatedAt = OffsetDateTime.now();
  }

  public void updateStatus(String newStatus, String techNotes) {
    if (newStatus != null && !VALID_STATUSES.contains(newStatus)) {
      throw new IllegalArgumentException("Estado no válido: " + newStatus);
    }
    if (newStatus != null) {
      this.status = newStatus;
    }
    if (techNotes != null) {
      this.technicianNotes = techNotes;
    }
    this.updatedAt = OffsetDateTime.now();
  }

  public void updateTechnicalDetails(
      String diagnosis, BigDecimal quote, String techNotes, OffsetDateTime estDelivery,
      UUID technicianId, Integer slaHours
  ) {
    if (diagnosis != null) this.diagnosis = diagnosis;
    if (quote != null) {
      if (quote.compareTo(BigDecimal.ZERO) < 0) {
        throw new IllegalArgumentException("La cotización no puede ser negativa");
      }
      this.quote = quote;
      if ("OPEN".equals(this.status) || "DIAGNOSIS".equals(this.status)) {
        this.status = "QUOTED";
      }
    }
    if (techNotes != null) this.technicianNotes = techNotes;
    if (estDelivery != null) this.estimatedDelivery = estDelivery;
    if (technicianId != null) this.assignedTechnicianId = technicianId;
    if (slaHours != null && slaHours > 0) {
      this.slaHours = slaHours;
      this.slaDeadline = this.createdAt.plusHours(this.slaHours);
    }
    this.updatedAt = OffsetDateTime.now();
  }

  public List<WorkOrderItem> getItems() {
    return items != null ? items : Collections.emptyList();
  }

  public void setItems(List<WorkOrderItem> items) {
    this.items = items != null ? new ArrayList<>(items) : new ArrayList<>();
    if (!this.items.isEmpty()) {
      BigDecimal total = BigDecimal.ZERO;
      for (WorkOrderItem it : this.items) {
        if (it.getSubtotal() != null) {
          total = total.add(it.getSubtotal());
        }
      }
      this.quote = total;
      if ("OPEN".equals(this.status) || "DIAGNOSIS".equals(this.status)) {
        this.status = "QUOTED";
      }
    }
    this.updatedAt = OffsetDateTime.now();
  }

  // Getters & Setters
  public UUID getId() { return id; }
  public UUID getTenantId() { return tenantId; }
  public UUID getCustomerId() { return customerId; }
  public UUID getBranchId() { return branchId; }
  public String getOrderNumber() { return orderNumber; }
  public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
  public String getDeviceBrand() { return deviceBrand; }
  public String getDeviceModel() { return deviceModel; }
  public String getSerialNumber() { return serialNumber; }
  public String getReportedFault() { return reportedFault; }
  public String getAccessories() { return accessories; }
  public String getDescription() { return description; }
  public String getDiagnosis() { return diagnosis; }
  public BigDecimal getQuote() { return quote; }
  public String getStatus() { return status; }
  public String getApprovalTokenHash() { return approvalTokenHash; }
  public OffsetDateTime getApprovalExpiresAt() { return approvalExpiresAt; }
  public OffsetDateTime getApprovedAt() { return approvedAt; }
  public String getApprovalUrl() { return approvalUrl; }
  public String getTechnicianNotes() { return technicianNotes; }
  public String getClientNotes() { return clientNotes; }
  public String getRejectionReason() { return rejectionReason; }
  public OffsetDateTime getEstimatedDelivery() { return estimatedDelivery; }
  public UUID getAssignedTechnicianId() { return assignedTechnicianId; }
  public void setAssignedTechnicianId(UUID id) { this.assignedTechnicianId = id; }
  public int getSlaHours() { return slaHours; }
  public void setSlaHours(int hours) { this.slaHours = hours; }
  public OffsetDateTime getSlaDeadline() { return slaDeadline; }
  public void setSlaDeadline(OffsetDateTime deadline) { this.slaDeadline = deadline; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
