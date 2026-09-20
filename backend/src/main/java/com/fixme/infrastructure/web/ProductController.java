package com.fixme.infrastructure.web;

import com.fixme.application.ProductService;
import com.fixme.domain.Product;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
public class ProductController {
  private final ProductService service;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;

  public ProductController(ProductService service, org.springframework.jdbc.core.JdbcTemplate jdbc) {
    this.service = service;
    this.jdbc = jdbc;
  }

  public record Input(
      String sku,
      String name,
      Integer stock,
      BigDecimal price,
      BigDecimal purchasePrice,
      BigDecimal extraCost,
      BigDecimal marginPercent,
      UUID categoryId,
      Integer minStock,
      String barcode
  ) {}

  public record MovementInput(String type, Integer quantity, String reason) {}

  @GetMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public List<Product> list(@RequestParam(required = false) UUID branchId, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    if (branchId == null) {
      try {
        branchId = jdbc.queryForObject("SELECT id FROM branches WHERE tenant_id = ? AND active = true ORDER BY created_at ASC LIMIT 1", UUID.class, tenant);
      } catch (Exception ignored) {}
    }
    return service.list(tenant, branchId);
  }

  @PostMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Product> create(@RequestParam UUID branchId, @AuthenticationPrincipal Jwt jwt,
      @RequestBody Input input) {
    validate(input);
    UUID tenant = tenant(jwt);
    return ResponseEntity.status(HttpStatus.CREATED).body(service.create(
        product(input, null, tenant), branchId));
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Product update(@PathVariable UUID id, @RequestParam UUID branchId, @AuthenticationPrincipal Jwt jwt,
      @RequestBody Input input) {
    validate(input);
    return service.update(product(input, id, tenant(jwt)), branchId);
  }

  @PostMapping("/batch-import")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> batchImport(
      @RequestParam UUID branchId,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody List<Input> items
  ) {
    UUID tenant = tenant(jwt);
    int imported = 0;
    int updated = 0;
    for (Input in : items) {
      if (in == null || in.sku() == null || in.sku().isBlank() || in.name() == null || in.name().isBlank()) continue;
      try {
        var existing = jdbc.queryForList("SELECT id FROM products WHERE tenant_id = ? AND sku = ?", tenant, in.sku().trim());
        if (existing.isEmpty()) {
          service.create(product(in, null, tenant), branchId);
          imported++;
        } else {
          UUID existingId = (UUID) existing.get(0).get("id");
          service.update(product(in, existingId, tenant), branchId);
          updated++;
        }
      } catch (Exception ignored) {}
    }
    return Map.of("imported", imported, "updated", updated, "total", items != null ? items.size() : 0);
  }

  @PostMapping("/{id}/movements")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Void> movement(@PathVariable UUID id, @RequestParam UUID branchId,
      @AuthenticationPrincipal Jwt jwt, @RequestBody MovementInput input) {
    if (input == null || input.type() == null || input.quantity() == null || input.quantity() <= 0)
      throw new IllegalArgumentException("tipo y cantidad positiva son obligatorios");
    UUID tenant = tenant(jwt);
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
    UUID user = jdbc.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)",
        UUID.class, tenant, jwt.getSubject());
    service.movement(tenant, branchId, id, input.quantity(), input.type().toUpperCase(Locale.ROOT),
        input.reason(), user);
    return ResponseEntity.noContent().build();
  }

  private void validate(Input i) {
    if (i == null || i.sku() == null || i.sku().isBlank() || i.name() == null || i.name().isBlank()
        || i.stock() == null || i.stock() < 0 || i.price() == null || i.price().signum() < 0
        || (i.purchasePrice() != null && i.purchasePrice().signum() < 0)
        || (i.extraCost() != null && i.extraCost().signum() < 0)
        || (i.marginPercent() != null && i.marginPercent().signum() < 0))
      throw new IllegalArgumentException("sku, nombre, precio y stock son obligatorios y válidos");
  }

  private Product product(Input i, UUID id, UUID tenant) {
    BigDecimal cost = i.purchasePrice() == null ? BigDecimal.ZERO : i.purchasePrice();
    BigDecimal extra = i.extraCost() == null ? BigDecimal.ZERO : i.extraCost();
    BigDecimal margin = i.marginPercent() == null
        ? (i.price().signum() == 0 ? BigDecimal.ZERO : i.price().subtract(cost).multiply(BigDecimal.valueOf(100))
            .divide(i.price(), 2, java.math.RoundingMode.HALF_UP)) : i.marginPercent();
    int minStock = i.minStock() != null && i.minStock() >= 0 ? i.minStock() : 5;
    String barcode = i.barcode() != null && !i.barcode().isBlank() ? i.barcode().trim() : i.sku().trim();
    return new Product(id, tenant, i.sku().trim(), i.name().trim(), i.stock(), i.price(), cost, extra, margin, i.categoryId(), minStock, barcode);
  }

  private UUID tenant(Jwt jwt) {
    try {
      String value = jwt == null ? null : jwt.getClaimAsString("tenant_id");
      if (value == null) throw new IllegalArgumentException("El token no contiene tenant_id");
      return UUID.fromString(value);
    } catch (RuntimeException e) {
      throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,
          "El token no contiene un tenant válido");
    }
  }
}
