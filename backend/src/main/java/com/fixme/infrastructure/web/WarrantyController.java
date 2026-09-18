package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import com.fixme.application.ModuleService;
import com.fixme.application.WorkOrderService;

@RestController
public class WarrantyController {
  private final JdbcTemplate db;
  private final ModuleService modules;
  private final WorkOrderService workOrderService;

  public WarrantyController(JdbcTemplate db, ModuleService modules, WorkOrderService workOrderService) {
    this.db = db;
    this.modules = modules;
    this.workOrderService = workOrderService;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private void ctx(UUID t) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
  }

  private void syncExpired(UUID t) {
    try {
      ctx(t);
      db.update("UPDATE warranties SET status='EXPIRED', updated_at=now() WHERE tenant_id=? AND status='ACTIVE' AND expires_at < now()", t);
    } catch (Exception ignored) {}
  }

  private Map<String, Object> getEnrichedWarranty(UUID t, UUID id) {
    ctx(t);
    String sql = """
        SELECT
          w.id,
          w.tenant_id,
          w.sale_id,
          w.sale_item_id,
          w.product_id,
          w.customer_id,
          COALESCE(w.warranty_code, 'GAR-' || UPPER(SUBSTRING(w.id::text, 1, 6))) AS warranty_code,
          w.serial_number,
          w.starts_at,
          w.expires_at,
          w.terms,
          w.status,
          w.claim_notes,
          w.claimed_at,
          w.claim_resolution,
          w.work_order_id,
          w.created_at,
          w.updated_at,
          p.name AS product_name,
          p.sku AS product_sku,
          p.price AS product_price,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.email AS customer_email,
          s.total AS sale_total,
          s.created_at AS sale_created_at,
          wo.order_number AS work_order_number,
          wo.status AS work_order_status,
          GREATEST(0, EXTRACT(DAY FROM (w.expires_at - now()))::int) AS remaining_days,
          (w.status = 'ACTIVE' AND w.expires_at >= now() AND w.expires_at <= now() + interval '15 days') AS is_expiring_soon
        FROM warranties w
        LEFT JOIN products p ON p.id = w.product_id
        LEFT JOIN customers c ON c.id = w.customer_id
        LEFT JOIN sales s ON s.id = w.sale_id
        LEFT JOIN work_orders wo ON wo.id = w.work_order_id
        WHERE w.tenant_id = ? AND w.id = ?
        """;
    return db.queryForMap(sql, t, id);
  }

  @GetMapping("/api/warranties")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> list(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(required = false) String saleId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search
  ) {
    UUID t = tenant(j);
    modules.require(t, "POS");
    syncExpired(t);
    ctx(t);

    StringBuilder sql = new StringBuilder("""
        SELECT
          w.id,
          w.tenant_id,
          w.sale_id,
          w.sale_item_id,
          w.product_id,
          w.customer_id,
          COALESCE(w.warranty_code, 'GAR-' || UPPER(SUBSTRING(w.id::text, 1, 6))) AS warranty_code,
          w.serial_number,
          w.starts_at,
          w.expires_at,
          w.terms,
          w.status,
          w.claim_notes,
          w.claimed_at,
          w.claim_resolution,
          w.work_order_id,
          w.created_at,
          w.updated_at,
          p.name AS product_name,
          p.sku AS product_sku,
          p.price AS product_price,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.email AS customer_email,
          s.total AS sale_total,
          s.created_at AS sale_created_at,
          wo.order_number AS work_order_number,
          wo.status AS work_order_status,
          GREATEST(0, EXTRACT(DAY FROM (w.expires_at - now()))::int) AS remaining_days,
          (w.status = 'ACTIVE' AND w.expires_at >= now() AND w.expires_at <= now() + interval '15 days') AS is_expiring_soon
        FROM warranties w
        LEFT JOIN products p ON p.id = w.product_id
        LEFT JOIN customers c ON c.id = w.customer_id
        LEFT JOIN sales s ON s.id = w.sale_id
        LEFT JOIN work_orders wo ON wo.id = w.work_order_id
        WHERE w.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (saleId != null && !saleId.isBlank()) {
      sql.append(" AND w.sale_id = ?");
      params.add(UUID.fromString(saleId));
    }

    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      if ("EXPIRING_SOON".equalsIgnoreCase(status)) {
        sql.append(" AND w.status = 'ACTIVE' AND w.expires_at >= now() AND w.expires_at <= now() + interval '15 days'");
      } else {
        sql.append(" AND w.status = ?");
        params.add(status.toUpperCase());
      }
    }

    if (search != null && !search.isBlank()) {
      String p = "%" + search.trim().toLowerCase() + "%";
      sql.append(" AND (LOWER(COALESCE(w.warranty_code, '')) LIKE ? OR LOWER(COALESCE(w.serial_number, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ? OR LOWER(COALESCE(p.sku, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(c.phone, '')) LIKE ?)");
      params.add(p);
      params.add(p);
      params.add(p);
      params.add(p);
      params.add(p);
      params.add(p);
    }

    sql.append(" ORDER BY w.created_at DESC");
    return db.queryForList(sql.toString(), params.toArray());
  }

  @GetMapping("/api/warranties/stats")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> stats(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    modules.require(t, "POS");
    syncExpired(t);
    ctx(t);

    String sql = """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at >= now()) AS active,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at >= now() AND expires_at <= now() + interval '15 days') AS expiring_soon,
          COUNT(*) FILTER (WHERE status = 'CLAIMED') AS claimed,
          COUNT(*) FILTER (WHERE status = 'EXPIRED' OR (status = 'ACTIVE' AND expires_at < now())) AS expired
        FROM warranties
        WHERE tenant_id = ?
        """;
    Map<String, Object> row = db.queryForMap(sql, t);
    return Map.of(
        "total", row.getOrDefault("total", 0),
        "active", row.getOrDefault("active", 0),
        "expiringSoon", row.getOrDefault("expiring_soon", 0),
        "claimed", row.getOrDefault("claimed", 0),
        "expired", row.getOrDefault("expired", 0)
    );
  }

  @GetMapping("/api/warranties/{id}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> getById(@AuthenticationPrincipal Jwt j, @PathVariable UUID id) {
    UUID t = tenant(j);
    modules.require(t, "POS");
    ctx(t);
    try {
      return ResponseEntity.ok(getEnrichedWarranty(t, id));
    } catch (Exception e) {
      return ResponseEntity.notFound().build();
    }
  }

  public record CreateWarrantyInput(
      UUID saleId,
      UUID saleItemId,
      UUID productId,
      UUID customerId,
      Integer days,
      String expiresAt,
      String serialNumber,
      String terms
  ) {}

  @PostMapping("/api/warranties")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal Jwt j, @RequestBody CreateWarrantyInput in) {
    if (in == null || in.productId() == null) {
      throw new IllegalArgumentException("El producto es obligatorio");
    }
    UUID t = tenant(j);
    modules.require(t, "POS");
    ctx(t);

    db.queryForObject("SELECT id FROM products WHERE id=? AND tenant_id=?", UUID.class, in.productId(), t);

    UUID custId = in.customerId();
    if (custId == null && in.saleId() != null) {
      try {
        custId = db.queryForObject("SELECT customer_id FROM sales WHERE id=? AND tenant_id=?", UUID.class, in.saleId(), t);
      } catch (Exception ignored) {}
    }

    OffsetDateTime expiry = in.expiresAt() == null || in.expiresAt().isBlank()
        ? OffsetDateTime.now().plusDays(in.days() == null || in.days() <= 0 ? 365 : in.days())
        : OffsetDateTime.parse(in.expiresAt());

    if (!expiry.isAfter(OffsetDateTime.now())) {
      throw new IllegalArgumentException("La fecha de vencimiento debe ser futura");
    }

    UUID id = UUID.randomUUID();
    int count = db.queryForObject("SELECT COUNT(*) FROM warranties WHERE tenant_id=?", Integer.class, t);
    String warrantyCode = String.format("GAR-%04d", count + 1);

    String terms = (in.terms() != null && !in.terms().isBlank())
        ? in.terms().trim()
        : ("Garantía técnica oficial de " + (in.days() == null ? 365 : in.days()) + " días ante defectos de fábrica.");

    db.update("""
        INSERT INTO warranties(id, tenant_id, sale_id, sale_item_id, product_id, customer_id, warranty_code, serial_number, expires_at, terms, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        """,
        id, t, in.saleId(), in.saleItemId(), in.productId(), custId, warrantyCode, in.serialNumber(), expiry, terms);

    return ResponseEntity.status(HttpStatus.CREATED).body(getEnrichedWarranty(t, id));
  }

  public record ClaimInput(
      String notes,
      String resolution,
      UUID branchId,
      UUID technicianId,
      Integer slaHours
  ) {}

  @PatchMapping("/api/warranties/{id}/claim")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> claim(
      @PathVariable UUID id,
      @AuthenticationPrincipal Jwt j,
      @RequestBody(required = false) ClaimInput body
  ) {
    UUID t = tenant(j);
    modules.require(t, "POS");
    ctx(t);

    Map<String, Object> existing;
    try {
      existing = db.queryForMap("SELECT * FROM warranties WHERE id=? AND tenant_id=?", id, t);
    } catch (Exception e) {
      throw new IllegalArgumentException("Garantía no encontrada: " + id);
    }

    String status = (String) existing.get("status");
    if (!"ACTIVE".equalsIgnoreCase(status)) {
      throw new IllegalArgumentException("Solo es posible procesar reclamos sobre garantías ACTIVAS. Estado actual: " + status);
    }

    String notes = body != null ? body.notes() : null;
    String resolution = (body != null && body.resolution() != null && !body.resolution().isBlank())
        ? body.resolution().toUpperCase()
        : "REPAIR_WORK_ORDER";

    UUID workOrderId = null;

    if ("REPAIR_WORK_ORDER".equalsIgnoreCase(resolution)) {
      UUID custId = (UUID) existing.get("customer_id");
      if (custId == null) {
        List<UUID> custs = db.queryForList("SELECT id FROM customers WHERE tenant_id=? ORDER BY created_at ASC LIMIT 1", UUID.class, t);
        if (!custs.isEmpty()) {
          custId = custs.get(0);
        } else {
          custId = UUID.randomUUID();
          db.update("INSERT INTO customers(id, tenant_id, name, phone) VALUES (?, ?, 'Cliente de Garantía', '0000000000')", custId, t);
        }
      }

      UUID brId = body != null ? body.branchId() : null;
      if (brId == null) {
        List<UUID> branches = db.queryForList("SELECT id FROM branches WHERE tenant_id=? ORDER BY created_at ASC LIMIT 1", UUID.class, t);
        if (!branches.isEmpty()) {
          brId = branches.get(0);
        }
      }

      UUID prodId = (UUID) existing.get("product_id");
      String prodName = "Producto";
      try {
        prodName = db.queryForObject("SELECT name FROM products WHERE id=? AND tenant_id=?", String.class, prodId, t);
      } catch (Exception ignored) {}

      String serial = (String) existing.get("serial_number");
      String warrantyCode = (String) existing.get("warranty_code");

      String fault = (notes != null && !notes.isBlank()) ? notes : ("Falla reportada bajo garantía (" + (warrantyCode != null ? warrantyCode : "") + ")");
      String fullDesc = "Reclamo Garantía [" + (warrantyCode != null ? warrantyCode : "GAR") + "]: " + prodName;

      List<WorkOrderService.OrderItemInput> items = List.of(
          new WorkOrderService.OrderItemInput("SERVICE", "Reparación por Garantía Oficial (" + prodName + ")", BigDecimal.ONE, BigDecimal.ZERO)
      );

      WorkOrderService.CreateOrderCommand cmd = new WorkOrderService.CreateOrderCommand(
          custId,
          brId,
          "Garantía",
          prodName,
          serial != null ? serial : "N/A",
          fault,
          "Equipo ingresado por garantía técnica",
          fullDesc,
          "Ingreso validado por Garantía Técnica oficial. Cobertura al 100% autorizada ($0.00).",
          BigDecimal.ZERO,
          OffsetDateTime.now().plusDays(2),
          body != null ? body.technicianId() : null,
          (body != null && body.slaHours() != null && body.slaHours() > 0) ? body.slaHours() : 48,
          items
      );

      var createdOrder = workOrderService.createOrder(t, cmd);
      workOrderId = createdOrder.getId();
    }

    db.update("""
        UPDATE warranties
        SET status = 'CLAIMED',
            claimed_at = now(),
            claim_notes = ?,
            claim_resolution = ?,
            work_order_id = ?,
            updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        notes, resolution, workOrderId, id, t);

    return ResponseEntity.ok(getEnrichedWarranty(t, id));
  }

  public record VoidInput(String reason) {}

  @PatchMapping("/api/warranties/{id}/void")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> voidWarranty(
      @PathVariable UUID id,
      @AuthenticationPrincipal Jwt j,
      @RequestBody(required = false) VoidInput body
  ) {
    UUID t = tenant(j);
    modules.require(t, "POS");
    ctx(t);

    String reason = body != null && body.reason() != null ? body.reason() : "Anulada por administrador";
    db.update("""
        UPDATE warranties
        SET status = 'VOID',
            claim_notes = ?,
            updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        "ANULADA: " + reason, id, t);

    return ResponseEntity.ok(getEnrichedWarranty(t, id));
  }

  @GetMapping("/api/public/warranties/verify")
  public ResponseEntity<Map<String, Object>> publicVerify(@RequestParam String token) {
    if (token == null || token.isBlank()) {
      return ResponseEntity.badRequest().build();
    }
    UUID t = null;
    String identifier = token.trim();
    if (token.contains(".")) {
      String[] parts = token.split("\\.", 2);
      try {
        t = UUID.fromString(parts[0]);
        identifier = parts[1];
      } catch (Exception ignored) {}
    }

    if (t != null) {
      ctx(t);
      syncExpired(t);
    }

    String sql = """
        SELECT
          w.id,
          w.tenant_id,
          COALESCE(w.warranty_code, 'GAR-' || UPPER(SUBSTRING(w.id::text, 1, 6))) AS warranty_code,
          w.serial_number,
          w.status,
          w.starts_at,
          w.expires_at,
          w.terms,
          w.claim_notes,
          w.claimed_at,
          w.claim_resolution,
          p.name AS product_name,
          p.sku AS product_sku,
          c.name AS customer_name,
          t.name AS store_name,
          GREATEST(0, EXTRACT(DAY FROM (w.expires_at - now()))::int) AS remaining_days,
          (w.status = 'ACTIVE' AND w.expires_at >= now() AND w.expires_at <= now() + interval '15 days') AS is_expiring_soon
        FROM warranties w
        JOIN tenants t ON t.id = w.tenant_id
        LEFT JOIN products p ON p.id = w.product_id
        LEFT JOIN customers c ON c.id = w.customer_id
        WHERE (w.warranty_code = ? OR w.id::text = ? OR w.serial_number = ?)
        """ + (t != null ? " AND w.tenant_id = '" + t + "'" : "") + " ORDER BY w.created_at DESC LIMIT 1";

    List<Map<String, Object>> res = db.queryForList(sql, identifier, identifier, identifier);
    if (res.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(res.get(0));
  }
}
