package com.fixme.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class QuoteItem {
  private UUID id;
  private UUID tenantId;
  private UUID quoteId;
  private UUID productId;
  private String itemType; // PRODUCT, SERVICE, LABOR
  private String description;
  private BigDecimal quantity;
  private BigDecimal unitPrice;
  private BigDecimal discount;
  private BigDecimal taxRate;
  private BigDecimal lineTotal;
  private OffsetDateTime createdAt;

  public QuoteItem(
      UUID id, UUID tenantId, UUID quoteId, UUID productId, String itemType,
      String description, BigDecimal quantity, BigDecimal unitPrice,
      BigDecimal discount, BigDecimal taxRate, BigDecimal lineTotal, OffsetDateTime createdAt
  ) {
    this.id = id;
    this.tenantId = tenantId;
    this.quoteId = quoteId;
    this.productId = productId;
    this.itemType = itemType != null ? itemType : "PRODUCT";
    this.description = description;
    this.quantity = quantity != null ? quantity : BigDecimal.ONE;
    this.unitPrice = unitPrice != null ? unitPrice : BigDecimal.ZERO;
    this.discount = discount != null ? discount : BigDecimal.ZERO;
    this.taxRate = taxRate != null ? taxRate : BigDecimal.valueOf(15.00);
    this.lineTotal = lineTotal != null ? lineTotal : BigDecimal.ZERO;
    this.createdAt = createdAt != null ? createdAt : OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getTenantId() { return tenantId; }
  public UUID getQuoteId() { return quoteId; }
  public UUID getProductId() { return productId; }
  public String getItemType() { return itemType; }
  public String getDescription() { return description; }
  public BigDecimal getQuantity() { return quantity; }
  public BigDecimal getUnitPrice() { return unitPrice; }
  public BigDecimal getDiscount() { return discount; }
  public BigDecimal getTaxRate() { return taxRate; }
  public BigDecimal getLineTotal() { return lineTotal; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}

