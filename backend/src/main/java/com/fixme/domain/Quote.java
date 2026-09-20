package com.fixme.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public class Quote {
  private UUID id;
  private UUID tenantId;
  private UUID branchId;
  private UUID userId;
  private UUID customerId;
  private String quoteNumber;
  private String customerName;
  private String customerPhone;
  private String customerEmail;
  private String customerIdNumber;
  private BigDecimal subtotal;
  private BigDecimal discount;
  private BigDecimal tax;
  private BigDecimal total;
  private String status; // DRAFT, PENDING, APPROVED, REJECTED, CONVERTED, EXPIRED
  private OffsetDateTime validUntil;
  private String notes;
  private String terms;
  private String publicToken;
  private UUID convertedSaleId;
  private OffsetDateTime convertedAt;
  private OffsetDateTime createdAt;
  private OffsetDateTime updatedAt;
  private List<QuoteItem> items = new ArrayList<>();

  public static final Set<String> VALID_STATUSES = Set.of(
      "DRAFT", "PENDING", "APPROVED", "REJECTED", "CONVERTED", "EXPIRED"
  );

  public Quote(
      UUID id, UUID tenantId, UUID branchId, UUID userId, UUID customerId,
      String quoteNumber, String customerName, String customerPhone, String customerEmail, String customerIdNumber,
      BigDecimal subtotal, BigDecimal discount, BigDecimal tax, BigDecimal total,
      String status, OffsetDateTime validUntil, String notes, String terms,
      String publicToken, UUID convertedSaleId, OffsetDateTime convertedAt,
      OffsetDateTime createdAt, OffsetDateTime updatedAt
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.branchId = branchId;
    this.userId = userId;
    this.customerId = customerId;
    this.quoteNumber = quoteNumber;
    this.customerName = customerName;
    this.customerPhone = customerPhone;
    this.customerEmail = customerEmail;
    this.customerIdNumber = customerIdNumber;
    this.subtotal = subtotal != null ? subtotal : BigDecimal.ZERO;
    this.discount = discount != null ? discount : BigDecimal.ZERO;
    this.tax = tax != null ? tax : BigDecimal.ZERO;
    this.total = total != null ? total : BigDecimal.ZERO;
    this.status = status != null ? status : "PENDING";
    this.validUntil = validUntil != null ? validUntil : OffsetDateTime.now().plusDays(15);
    this.notes = notes;
    this.terms = terms;
    this.publicToken = publicToken;
    this.convertedSaleId = convertedSaleId;
    this.convertedAt = convertedAt;
    this.createdAt = createdAt != null ? createdAt : OffsetDateTime.now();
    this.updatedAt = updatedAt != null ? updatedAt : OffsetDateTime.now();
  }

  public boolean isPending() {
    return "PENDING".equalsIgnoreCase(status) || "DRAFT".equalsIgnoreCase(status);
  }

  public void approve() {
    this.status = "APPROVED";
    this.updatedAt = OffsetDateTime.now();
  }

  public void reject() {
    this.status = "REJECTED";
    this.updatedAt = OffsetDateTime.now();
  }

  public void markConverted(UUID saleId) {
    this.status = "CONVERTED";
    this.convertedSaleId = saleId;
    this.convertedAt = OffsetDateTime.now();
    this.updatedAt = OffsetDateTime.now();
  }

  public void updateDetails(
      UUID customerId, String customerName, String customerPhone, String customerEmail, String customerIdNumber,
      BigDecimal subtotal, BigDecimal discount, BigDecimal tax, BigDecimal total,
      OffsetDateTime validUntil, String notes, String terms, List<QuoteItem> items
  ) {
    this.customerId = customerId;
    this.customerName = customerName;
    this.customerPhone = customerPhone;
    this.customerEmail = customerEmail;
    this.customerIdNumber = customerIdNumber;
    this.subtotal = subtotal != null ? subtotal : BigDecimal.ZERO;
    this.discount = discount != null ? discount : BigDecimal.ZERO;
    this.tax = tax != null ? tax : BigDecimal.ZERO;
    this.total = total != null ? total : BigDecimal.ZERO;
    this.validUntil = validUntil;
    this.notes = notes;
    this.terms = terms;
    this.items = items != null ? items : new ArrayList<>();
    this.updatedAt = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getTenantId() { return tenantId; }
  public UUID getBranchId() { return branchId; }
  public UUID getUserId() { return userId; }
  public UUID getCustomerId() { return customerId; }
  public String getQuoteNumber() { return quoteNumber; }
  public String getCustomerName() { return customerName; }
  public String getCustomerPhone() { return customerPhone; }
  public String getCustomerEmail() { return customerEmail; }
  public String getCustomerIdNumber() { return customerIdNumber; }
  public BigDecimal getSubtotal() { return subtotal; }
  public BigDecimal getDiscount() { return discount; }
  public BigDecimal getTax() { return tax; }
  public BigDecimal getTotal() { return total; }
  public String getStatus() { return status; }
  public OffsetDateTime getValidUntil() { return validUntil; }
  public String getNotes() { return notes; }
  public String getTerms() { return terms; }
  public String getPublicToken() { return publicToken; }
  public UUID getConvertedSaleId() { return convertedSaleId; }
  public OffsetDateTime getConvertedAt() { return convertedAt; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public List<QuoteItem> getItems() { return items; }
  public void setItems(List<QuoteItem> items) { this.items = items != null ? items : new ArrayList<>(); }
}

