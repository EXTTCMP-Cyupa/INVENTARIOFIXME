package com.fixme.domain;

import java.math.BigDecimal;
import java.util.UUID;

public record Product(
    UUID id,
    UUID tenantId,
    String sku,
    String name,
    int stock,
    BigDecimal price,
    BigDecimal purchasePrice,
    BigDecimal extraCost,
    BigDecimal marginPercent,
    UUID categoryId,
    int minStock,
    String barcode
) {
  public Product(UUID id, UUID tenantId, String sku, String name, int stock, BigDecimal price,
                 BigDecimal purchasePrice, BigDecimal extraCost, BigDecimal marginPercent, UUID categoryId) {
    this(id, tenantId, sku, name, stock, price, purchasePrice, extraCost, marginPercent, categoryId, 5, sku);
  }

  public Product(UUID id, UUID tenantId, String sku, String name, int stock, BigDecimal price, UUID categoryId) {
    this(id, tenantId, sku, name, stock, price, BigDecimal.ZERO, BigDecimal.ZERO,
        price == null || price.signum() == 0 ? BigDecimal.ZERO : price.subtract(BigDecimal.ZERO)
            .multiply(BigDecimal.valueOf(100)).divide(price, 2, java.math.RoundingMode.HALF_UP), categoryId, 5, sku);
  }

  public Product(UUID id, UUID tenantId, String sku, String name, int stock, BigDecimal price,
                 BigDecimal purchasePrice, BigDecimal marginPercent, UUID categoryId) {
    this(id, tenantId, sku, name, stock, price, purchasePrice, BigDecimal.ZERO, marginPercent, categoryId, 5, sku);
  }

  public Product {
    if (tenantId == null || sku == null || sku.isBlank() || name == null || name.isBlank()
        || stock < 0 || price == null || price.signum() < 0 || purchasePrice == null
        || purchasePrice.signum() < 0 || extraCost == null || extraCost.signum() < 0
        || marginPercent == null || marginPercent.signum() < 0) {
      throw new IllegalArgumentException("sku, nombre, precio y stock deben ser válidos");
    }
    if (minStock < 0) minStock = 5;
    if (barcode == null || barcode.isBlank()) barcode = sku;
  }
}
