package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
public class PurchasesAndSuppliersController {
  private final JdbcTemplate db;

  public PurchasesAndSuppliersController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  private UUID userId(Jwt jwt) {
    try {
      String sub = jwt.getSubject();
      return sub != null ? UUID.fromString(sub) : null;
    } catch (Exception e) {
      return null;
    }
  }

  private void context(UUID tenant) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
  }

  // ==========================================
  // 1. PROVEEDORES (SUPPLIERS)
  // ==========================================

  @GetMapping("/api/suppliers")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> listSuppliers(@AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    return db.queryForList("""
        SELECT id, name, tax_id, contact_name, phone, email, address, notes, created_at
        FROM suppliers
        WHERE tenant_id = ?
        ORDER BY name ASC
        """, tenant);
  }

  @PostMapping("/api/suppliers")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> createSupplier(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> body) {
    String name = body != null && body.get("name") != null ? body.get("name").toString().trim() : "";
    if (name.isBlank()) throw new IllegalArgumentException("El nombre del proveedor es obligatorio");

    UUID tenant = tenant(jwt);
    context(tenant);
    UUID id = UUID.randomUUID();

    db.update("""
        INSERT INTO suppliers (id, tenant_id, name, tax_id, contact_name, phone, email, address, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        id, tenant, name,
        body.get("tax_id"), body.get("contact_name"), body.get("phone"),
        body.get("email"), body.get("address"), body.get("notes")
    );

    return db.queryForMap("SELECT * FROM suppliers WHERE id = ?", id);
  }

  @PutMapping("/api/suppliers/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateSupplier(
      @PathVariable UUID id,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, Object> body
  ) {
    String name = body != null && body.get("name") != null ? body.get("name").toString().trim() : "";
    if (name.isBlank()) throw new IllegalArgumentException("El nombre del proveedor es obligatorio");

    UUID tenant = tenant(jwt);
    context(tenant);

    db.update("""
        UPDATE suppliers
        SET name = ?, tax_id = ?, contact_name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        name, body.get("tax_id"), body.get("contact_name"), body.get("phone"),
        body.get("email"), body.get("address"), body.get("notes"),
        id, tenant
    );

    return db.queryForMap("SELECT * FROM suppliers WHERE id = ?", id);
  }

  @DeleteMapping("/api/suppliers/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> deleteSupplier(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    db.update("DELETE FROM suppliers WHERE id = ? AND tenant_id = ?", id, tenant);
    return Map.of("ok", true, "id", id.toString());
  }

  // ==========================================
  // 2. COMPRAS Y KARDEX (PURCHASES)
  // ==========================================

  @GetMapping("/api/purchases")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> listPurchases(@AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    return db.queryForList("""
        SELECT
          p.id, p.invoice_number, p.purchase_date, p.subtotal, p.tax_amount, p.total,
          p.status, p.payment_status, p.notes, p.created_at,
          s.name AS supplier_name, s.tax_id AS supplier_tax_id,
          b.name AS branch_name,
          COUNT(pi.id) AS items_count
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN branches b ON b.id = p.branch_id
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE p.tenant_id = ?
        GROUP BY p.id, s.name, s.tax_id, b.name
        ORDER BY p.purchase_date DESC, p.created_at DESC
        """, tenant);
  }

  @GetMapping("/api/purchases/{id}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> getPurchaseDetail(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);

    Map<String, Object> purchase = db.queryForMap("""
        SELECT
          p.*,
          s.name AS supplier_name, s.tax_id AS supplier_tax_id, s.phone AS supplier_phone,
          b.name AS branch_name
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN branches b ON b.id = p.branch_id
        WHERE p.id = ? AND p.tenant_id = ?
        """, id, tenant);

    List<Map<String, Object>> items = db.queryForList("""
        SELECT
          pi.id, pi.product_id, pi.quantity, pi.unit_cost, pi.total_cost,
          pr.name AS product_name, pr.sku AS product_sku
        FROM purchase_items pi
        JOIN products pr ON pr.id = pi.product_id
        WHERE pi.purchase_id = ? AND pi.tenant_id = ?
        ORDER BY pi.id ASC
        """, id, tenant);

    Map<String, Object> result = new HashMap<>(purchase);
    result.put("items", items);
    return result;
  }

  public record PurchaseItemInput(UUID productId, Integer quantity, BigDecimal unitCost) {}
  public record CreatePurchaseInput(
      UUID supplierId,
      UUID branchId,
      String invoiceNumber,
      String purchaseDate,
      BigDecimal subtotal,
      BigDecimal taxAmount,
      BigDecimal total,
      String paymentStatus,
      String notes,
      List<PurchaseItemInput> items
  ) {}

  @PostMapping("/api/purchases")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  @Transactional
  public Map<String, Object> createPurchase(@AuthenticationPrincipal Jwt jwt, @RequestBody CreatePurchaseInput in) {
    if (in.items() == null || in.items().isEmpty()) {
      throw new IllegalArgumentException("La compra debe incluir al menos un producto");
    }

    UUID tenant = tenant(jwt);
    UUID uid = userId(jwt);
    context(tenant);

    UUID branchId = in.branchId();
    if (branchId == null) {
      List<UUID> b = db.queryForList("SELECT id FROM branches WHERE tenant_id = ? LIMIT 1", UUID.class, tenant);
      if (!b.isEmpty()) branchId = b.get(0);
    }

    UUID purchaseId = UUID.randomUUID();
    BigDecimal subtotal = in.subtotal() != null ? in.subtotal() : BigDecimal.ZERO;
    BigDecimal tax = in.taxAmount() != null ? in.taxAmount() : BigDecimal.ZERO;
    BigDecimal total = in.total() != null ? in.total() : subtotal.add(tax);

    db.update("""
        INSERT INTO purchases (
          id, tenant_id, branch_id, supplier_id, invoice_number,
          purchase_date, subtotal, tax_amount, total, status, payment_status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, COALESCE(?::date, CURRENT_DATE), ?, ?, ?, 'COMPLETED', COALESCE(?, 'PAID'), ?, ?)
        """,
        purchaseId, tenant, branchId, in.supplierId(), in.invoiceNumber(),
        in.purchaseDate(), subtotal, tax, total, in.paymentStatus(), in.notes(), uid
    );

    for (PurchaseItemInput it : in.items()) {
      if (it.productId() == null || it.quantity() == null || it.quantity() <= 0) continue;
      BigDecimal unitCost = it.unitCost() != null ? it.unitCost() : BigDecimal.ZERO;
      BigDecimal itemTotal = unitCost.multiply(BigDecimal.valueOf(it.quantity()));

      UUID itemId = UUID.randomUUID();
      db.update("""
          INSERT INTO purchase_items (id, tenant_id, purchase_id, product_id, quantity, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """,
          itemId, tenant, purchaseId, it.productId(), it.quantity(), unitCost, itemTotal
      );

      // Increment stock in products table
      db.update("""
          UPDATE products
          SET stock = COALESCE(stock, 0) + ?,
              purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
              updated_at = now()
          WHERE id = ? AND tenant_id = ?
          """,
          it.quantity(), unitCost, unitCost, it.productId(), tenant
      );

      // Increment stock in branch product_stock if branch exists
      if (branchId != null) {
        db.update("""
            INSERT INTO product_stock (id, tenant_id, product_id, branch_id, stock)
            VALUES (uuid_generate_v4(), ?, ?, ?, ?)
            ON CONFLICT (product_id, branch_id)
            DO UPDATE SET stock = product_stock.stock + EXCLUDED.stock, updated_at = now()
            """,
            tenant, it.productId(), branchId, it.quantity()
        );
      }

      // Record in Kardex (inventory_movements)
      db.update("""
          INSERT INTO inventory_movements (
            id, tenant_id, branch_id, product_id, type, quantity, reason,
            reference_id, reference_type, unit_cost, created_by
          ) VALUES (uuid_generate_v4(), ?, ?, ?, 'IN', ?, ?, ?, 'PURCHASE', ?, ?)
          """,
          tenant, branchId, it.productId(), it.quantity(),
          "Compra / Factura: " + (in.invoiceNumber() != null ? in.invoiceNumber() : "S/N"),
          purchaseId, unitCost, uid
      );
    }

    return getPurchaseDetail(purchaseId, jwt);
  }

  // ==========================================
  // 3. KARDEX DETALLADO POR PRODUCTO
  // ==========================================

  @GetMapping("/api/kardex/{productId}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> getProductKardex(@PathVariable UUID productId, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);

    Map<String, Object> product = db.queryForMap("""
        SELECT id, name, sku, stock, purchase_price, price
        FROM products
        WHERE id = ? AND tenant_id = ?
        """, productId, tenant);

    List<Map<String, Object>> movements = db.queryForList("""
        SELECT
          im.id, im.type, im.quantity, im.reason, im.reference_id, im.reference_type,
          im.unit_cost, im.created_at,
          b.name AS branch_name,
          u.name AS user_name
        FROM inventory_movements im
        LEFT JOIN branches b ON b.id = im.branch_id
        LEFT JOIN app_users u ON u.id = im.created_by
        WHERE im.product_id = ? AND im.tenant_id = ?
        ORDER BY im.created_at DESC
        LIMIT 100
        """, productId, tenant);

    Map<String, Object> res = new HashMap<>(product);
    res.put("movements", movements);
    return res;
  }
}

