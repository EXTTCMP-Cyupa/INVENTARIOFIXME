package com.fixme.infrastructure.web;

import com.fixme.application.*;
import com.fixme.domain.Sale;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sales")
public class SaleController {
  private final SaleService service;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;
  private final SriInvoiceController sriInvoiceController;

  public SaleController(SaleService s, org.springframework.jdbc.core.JdbcTemplate j, SriInvoiceController sri) {
    this.service = s;
    this.jdbc = j;
    this.sriInvoiceController = sri;
  }

  public record Item(UUID productId, int quantity) {}
  public record Payment(String method, String paymentMethod, BigDecimal amount) {
    public String resolvedMethod() {
      if (method != null && !method.isBlank()) return method;
      if (paymentMethod != null && !paymentMethod.isBlank()) return paymentMethod;
      return "CASH";
    }
  }
  public record DeliveryInput(
      String recipientName,
      String recipientPhone,
      String address,
      String notes,
      String courier,
      BigDecimal shippingCost
  ) {}

  public record Input(
      UUID branchId,
      UUID customerId,
      Integer warrantyDays,
      String channel,
      String fulfillmentType,
      BigDecimal shippingCost,
      DeliveryInput delivery,
      List<Item> items,
      List<Payment> payments,
      String invoiceType, // "INTERNAL_TICKET" or "SRI_INVOICE"
      String offlineFolio,
      BigDecimal discount
  ) {}

  @PostMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody Input in) {
    UUID t = tenant(jwt);
    UUID u = user(t, jwt.getSubject());

    SalePort.DeliveryInfo deliveryInfo = in.delivery() == null ? null : new SalePort.DeliveryInfo(
        in.delivery().recipientName(),
        in.delivery().recipientPhone(),
        in.delivery().address(),
        in.delivery().notes(),
        in.delivery().courier(),
        in.delivery().shippingCost()
    );

    Sale sale = service.create(
        t,
        in.branchId(),
        u,
        in.items().stream().map(i -> new SalePort.Item(i.productId(), i.quantity())).toList(),
        in.payments().stream().map(p -> new SalePort.Payment(p.resolvedMethod().toUpperCase(Locale.ROOT), p.amount())).toList(),
        in.customerId(),
        in.warrantyDays(),
        in.channel(),
        in.fulfillmentType(),
        in.shippingCost(),
        deliveryInfo,
        in.discount()
    );

    String invType = (in.invoiceType() != null && "SRI_INVOICE".equalsIgnoreCase(in.invoiceType()))
        ? "SRI_INVOICE" : "INTERNAL_TICKET";

    jdbc.update("UPDATE sales SET invoice_type = ?, offline_folio = ? WHERE id = ? AND tenant_id = ?",
        invType, in.offlineFolio(), sale.id(), t);

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("id", sale.id());
    resp.put("tenantId", sale.tenantId());
    resp.put("branchId", sale.branchId());
    resp.put("userId", sale.userId());
    resp.put("subtotal", sale.subtotal());
    resp.put("discount", sale.discount() != null ? sale.discount() : BigDecimal.ZERO);
    resp.put("tax", sale.tax());
    resp.put("total", sale.total());
    resp.put("status", sale.status());
    resp.put("invoiceType", invType);
    resp.put("offlineFolio", in.offlineFolio());
    resp.put("createdAt", sale.createdAt());

    try {
      var dList = jdbc.queryForList("select id, tracking_number, status, courier, address, recipient_name, recipient_phone from deliveries where sale_id = ? and tenant_id = ?", sale.id(), t);
      if (!dList.isEmpty()) {
        resp.put("deliveryId", dList.get(0).get("id"));
        resp.put("trackingNumber", dList.get(0).get("tracking_number"));
        resp.put("deliveryStatus", dList.get(0).get("status"));
        resp.put("courier", dList.get(0).get("courier"));
      }
    } catch (Exception ignored) {}

    // Auto-issue SRI electronic invoice if requested
    if ("SRI_INVOICE".equals(invType)) {
      try {
        var sriInv = sriInvoiceController.issueInvoiceFromSale(jwt, sale.id(), null);
        resp.put("electronicInvoice", sriInv);
        resp.put("electronicInvoiceId", sriInv.get("id"));
        resp.put("electronic_invoice_id", sriInv.get("id"));
        resp.put("invoiceNumber", sriInv.get("numero_completo"));
        resp.put("accessKey", sriInv.get("clave_acceso"));
        resp.put("sriStatus", sriInv.get("estado_sri"));
      } catch (Exception e) {
        resp.put("sriError", e.getMessage());
      }
    }

    return resp;
  }

  @PostMapping("/sync-offline")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  public Map<String, Object> syncOffline(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody List<Input> offlineSales
  ) {
    UUID t = tenant(jwt);
    List<Map<String, Object>> synced = new ArrayList<>();
    List<Map<String, Object>> failed = new ArrayList<>();

    if (offlineSales != null) {
      for (Input in : offlineSales) {
        try {
          if (in.offlineFolio() != null && !in.offlineFolio().isBlank()) {
            var exists = jdbc.queryForList("SELECT id, total, invoice_type FROM sales WHERE tenant_id = ? AND offline_folio = ?", t, in.offlineFolio());
            if (!exists.isEmpty()) {
              synced.add(Map.of("offlineFolio", in.offlineFolio(), "id", exists.get(0).get("id"), "alreadySynced", true));
              continue;
            }
          }
          var created = create(jwt, in);
          synced.add(Map.of("offlineFolio", in.offlineFolio() != null ? in.offlineFolio() : "", "id", created.get("id"), "status", "SYNCED"));
        } catch (Exception e) {
          failed.add(Map.of("offlineFolio", in.offlineFolio() != null ? in.offlineFolio() : "", "error", e.getMessage()));
        }
      }
    }

    return Map.of("success", true, "syncedCount", synced.size(), "failedCount", failed.size(), "synced", synced, "failed", failed);
  }

  @GetMapping("/stats")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public Map<String, Object> stats(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) UUID branchId) {
    UUID t = tenant(jwt);
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    String sql = """
        SELECT
          COUNT(*) AS total_tickets,
          COALESCE(SUM(s.total), 0) AS total_revenue,
          COALESCE(SUM((SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id)), 0) AS total_cogs,
          COALESCE(SUM(s.total - COALESCE(s.shipping_cost, 0) - (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id)), 0) AS gross_profit,
          COALESCE(AVG(s.total), 0) AS avg_ticket,
          COUNT(*) FILTER (WHERE s.created_at >= CURRENT_DATE) AS today_tickets,
          COALESCE(SUM(s.total) FILTER (WHERE s.created_at >= CURRENT_DATE), 0) AS today_revenue,
          COUNT(*) FILTER (WHERE s.channel = 'STORE') AS store_tickets,
          COALESCE(SUM(s.total) FILTER (WHERE s.channel = 'STORE'), 0) AS store_revenue,
          COUNT(*) FILTER (WHERE s.channel = 'ONLINE') AS online_tickets,
          COALESCE(SUM(s.total) FILTER (WHERE s.channel = 'ONLINE'), 0) AS online_revenue,
          COUNT(*) FILTER (WHERE s.fulfillment_type = 'DELIVERY') AS delivery_tickets
        FROM sales s
        WHERE s.tenant_id = ?
        """;

    if (branchId != null) {
      return jdbc.queryForMap(sql + " AND s.branch_id = ?", t, branchId);
    } else {
      return jdbc.queryForMap(sql, t);
    }
  }

  @GetMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) UUID branchId) {
    UUID t = tenant(jwt);
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    String sql = """
        SELECT s.id, s.branch_id, s.user_id, s.customer_id, s.subtotal, COALESCE(s.discount, 0.00) AS discount, s.tax, s.total, s.status,
               s.warranty_days, s.created_at, s.channel, s.fulfillment_type, s.shipping_cost, s.delivery_notes,
               s.invoice_type, s.offline_folio, COALESCE(s.electronic_invoice_id, ei.id) AS electronic_invoice_id,
               ei.numero_completo AS invoice_number, ei.clave_acceso AS invoice_access_key,
               ei.estado_sri AS invoice_sri_status, ei.fecha_autorizacion AS invoice_auth_date,
               b.name AS branch_name,
               COALESCE(NULLIF(u.full_name, ''), u.email) AS seller,
               COALESCE(NULLIF(u.full_name, ''), u.email) AS seller_name,
               u.email AS seller_email, u.role AS seller_role,
               c.name AS customer, c.name AS customer_name,
               c.identification_type AS customer_identification_type,
               c.identification_number AS customer_identification_number,
               c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
               d.id AS delivery_id, d.status AS delivery_status, d.courier, d.address AS delivery_address,
               d.recipient_name, d.recipient_phone, d.tracking_number, d.tracking_url,
               (SELECT string_agg(p.payment_method, ', ') FROM payments p WHERE p.sale_id = s.id) AS payment_methods,
               (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id) AS total_cost,
               (s.total - COALESCE(s.shipping_cost, 0) - (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id)) AS gross_profit,
               (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS items_count,
               (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) AS items_quantity,
               (SELECT w.warranty_code FROM warranties w WHERE w.sale_id = s.id LIMIT 1) AS warranty_code
        FROM sales s
        JOIN app_users u ON u.id = s.user_id
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN deliveries d ON d.sale_id = s.id
        LEFT JOIN electronic_invoices ei ON ei.id = COALESCE(s.electronic_invoice_id, (SELECT ei2.id FROM electronic_invoices ei2 WHERE ei2.sale_id = s.id ORDER BY ei2.created_at DESC LIMIT 1))
        WHERE s.tenant_id = ?
        """;

    if (branchId != null) {
      return jdbc.queryForList(sql + " AND s.branch_id = ? ORDER BY s.created_at DESC", t, branchId);
    } else {
      return jdbc.queryForList(sql + " ORDER BY s.created_at DESC", t);
    }
  }

  @GetMapping("/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public Map<String, Object> getById(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    UUID t = tenant(jwt);
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    String sql = """
        SELECT s.id, s.branch_id, s.user_id, s.customer_id, s.subtotal, COALESCE(s.discount, 0.00) AS discount, s.tax, s.total, s.status,
               s.warranty_days, s.created_at, s.channel, s.fulfillment_type, s.shipping_cost, s.delivery_notes,
               s.invoice_type, s.offline_folio, COALESCE(s.electronic_invoice_id, ei.id) AS electronic_invoice_id,
               ei.numero_completo AS invoice_number, ei.clave_acceso AS invoice_access_key,
               ei.estado_sri AS invoice_sri_status, ei.fecha_autorizacion AS invoice_auth_date,
               (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id) AS total_cost,
               (s.total - COALESCE(s.shipping_cost, 0) - (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id)) AS gross_profit,
               b.name AS branch_name,
               COALESCE(NULLIF(u.full_name, ''), u.email) AS seller,
               COALESCE(NULLIF(u.full_name, ''), u.email) AS seller_name,
               u.email AS seller_email, u.role AS seller_role,
               c.name AS customer, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               c.identification_type AS customer_identification_type,
               c.identification_number AS customer_identification_number,
               c.address AS customer_address,
               d.id AS delivery_id, d.status AS delivery_status, d.courier, d.address AS delivery_address,
               d.recipient_name, d.recipient_phone, d.tracking_number, d.tracking_url,
               (SELECT w.warranty_code FROM warranties w WHERE w.sale_id = s.id LIMIT 1) AS warranty_code,
               (SELECT w.id FROM warranties w WHERE w.sale_id = s.id LIMIT 1) AS warranty_id
        FROM sales s
        JOIN app_users u ON u.id = s.user_id
        LEFT JOIN branches b ON b.id = s.branch_id
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN deliveries d ON d.sale_id = s.id
        LEFT JOIN electronic_invoices ei ON ei.id = COALESCE(s.electronic_invoice_id, (SELECT ei2.id FROM electronic_invoices ei2 WHERE ei2.sale_id = s.id ORDER BY ei2.created_at DESC LIMIT 1))
        WHERE s.tenant_id = ? AND s.id = ?
        """;

    var sale = jdbc.queryForMap(sql, t, id);

    var items = jdbc.queryForList("""
        SELECT si.id, si.product_id, si.quantity, si.unit_price, si.unit_price AS price, si.cost_price,
               si.cost_price AS unit_cost,
               si.line_total, si.line_total AS subtotal,
               (si.quantity * si.cost_price) AS total_cost,
               (si.line_total - (si.quantity * si.cost_price)) AS gross_profit,
               p.name AS product_name, p.sku AS product_sku
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.tenant_id = ? AND si.sale_id = ?
        """, t, id);

    var payments = jdbc.queryForList("""
        SELECT id, payment_method, amount
        FROM payments
        WHERE tenant_id = ? AND sale_id = ?
        """, t, id);

    Map<String, Object> out = new HashMap<>(sale);
    out.put("items", items);
    out.put("payments", payments);
    return out;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String email) {
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
    return jdbc.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, email);
  }
}
