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

  public SaleController(SaleService s, org.springframework.jdbc.core.JdbcTemplate j) {
    this.service = s;
    this.jdbc = j;
  }

  public record Item(UUID productId, int quantity) {}
  public record Payment(String method, BigDecimal amount) {}
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
      List<Payment> payments
  ) {}

  @PostMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  public Sale create(@AuthenticationPrincipal Jwt jwt, @RequestBody Input in) {
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

    return service.create(
        t,
        in.branchId(),
        u,
        in.items().stream().map(i -> new SalePort.Item(i.productId(), i.quantity())).toList(),
        in.payments().stream().map(p -> new SalePort.Payment(p.method().toUpperCase(Locale.ROOT), p.amount())).toList(),
        in.customerId(),
        in.warrantyDays(),
        in.channel(),
        in.fulfillmentType(),
        in.shippingCost(),
        deliveryInfo
    );
  }

  @GetMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public List<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) UUID branchId) {
    UUID t = tenant(jwt);
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    String sql = """
        SELECT s.id, s.branch_id, s.user_id, s.customer_id, s.subtotal, s.tax, s.total, s.status,
               s.warranty_days, s.created_at, s.channel, s.fulfillment_type, s.shipping_cost, s.delivery_notes,
               COALESCE(NULLIF(u.full_name, ''), u.email) AS seller,
               c.name AS customer, c.phone AS customer_phone,
               d.id AS delivery_id, d.status AS delivery_status, d.courier, d.address AS delivery_address,
               (SELECT string_agg(p.payment_method, ', ') FROM payments p WHERE p.sale_id = s.id) AS payment_methods,
               (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id) AS total_cost,
               (s.total - COALESCE(s.shipping_cost, 0) - (SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) FROM sale_items si WHERE si.sale_id = s.id)) AS gross_profit
        FROM sales s
        JOIN app_users u ON u.id = s.user_id
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN deliveries d ON d.sale_id = s.id
        WHERE s.tenant_id = ? AND (? IS NULL OR s.branch_id = ?)
        ORDER BY s.created_at DESC
        """;

    return jdbc.queryForList(sql, t, branchId, branchId);
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String email) {
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
    return jdbc.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, email);
  }
}
