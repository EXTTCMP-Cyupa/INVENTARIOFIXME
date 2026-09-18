package com.fixme.infrastructure.persistence;

import com.fixme.application.*;
import com.fixme.domain.Sale;
import java.math.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcSaleAdapter implements SalePort {
  private final JdbcTemplate jdbc;

  public JdbcSaleAdapter(JdbcTemplate j) {
    this.jdbc = j;
  }

  private void tenant(UUID t) {
    jdbc.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
  }

  @Transactional
  public Sale create(
      UUID t,
      UUID b,
      UUID u,
      List<Item> items,
      List<Payment> payments,
      UUID customerId,
      Integer warrantyDays,
      String channel,
      String fulfillmentType,
      BigDecimal shippingCost,
      DeliveryInfo delivery
  ) {
    tenant(t);
    jdbc.queryForObject("select id from branches where id=? and tenant_id=? and active", UUID.class, b, t);

    UUID id = UUID.randomUUID();
    BigDecimal subtotal = BigDecimal.ZERO;
    List<Object[]> rows = new ArrayList<>();

    UUID session = null;
    var sessions = jdbc.query("select id from cash_sessions where tenant_id=? and branch_id=? and status='OPEN'", (r, n) -> r.getObject(1, UUID.class), t, b);
    if (payments.stream().anyMatch(p -> "CASH".equals(p.method())) && sessions.isEmpty()) {
      throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Debe abrir la caja antes de vender en efectivo");
    }
    if (!sessions.isEmpty()) session = sessions.get(0);

    for (Item i : items) {
      var p = jdbc.queryForMap(
          "select p.price, coalesce(p.purchase_price, 0) as purchase_price, coalesce(ps.stock,0) as stock " +
          "from products p join product_stock ps on ps.product_id=p.id and ps.branch_id=? " +
          "where p.id=? and p.tenant_id=? for update",
          b, i.productId(), t
      );
      int stock = ((Number) p.get("stock")).intValue();
      if (stock < i.quantity()) {
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Stock insuficiente para " + i.productId());
      }
      BigDecimal price = (BigDecimal) p.get("price");
      BigDecimal cost = p.get("purchase_price") instanceof BigDecimal bd ? bd : new BigDecimal(String.valueOf(p.get("purchase_price")));
      BigDecimal line = price.multiply(BigDecimal.valueOf(i.quantity()));
      subtotal = subtotal.add(line);
      rows.add(new Object[]{i, price, line, cost});
    }

    BigDecimal finalShipping = shippingCost != null && shippingCost.signum() > 0 ? shippingCost : BigDecimal.ZERO;
    BigDecimal total = subtotal.add(finalShipping);
    BigDecimal paid = payments.stream().map(Payment::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (paid.compareTo(total) < 0) {
      throw new IllegalArgumentException("Pagos insuficientes. Total requerido: $" + total + ", total recibido: $" + paid);
    }

    int warranty = Math.max(0, warrantyDays == null ? 0 : warrantyDays);
    if (customerId != null) {
      jdbc.queryForObject("select id from customers where id=? and tenant_id=?", UUID.class, customerId, t);
    }

    String finalChannel = "ONLINE".equalsIgnoreCase(channel) ? "ONLINE" : "STORE";
    String finalFulfillment = "DELIVERY".equalsIgnoreCase(fulfillmentType) ? "DELIVERY" : "PICKUP";
    String deliveryNotes = delivery != null ? delivery.notes() : null;

    jdbc.update(
        "insert into sales(id, tenant_id, branch_id, user_id, customer_id, warranty_days, subtotal, total, cash_session_id, channel, fulfillment_type, shipping_cost, delivery_notes) " +
        "values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id, t, b, u, customerId, warranty, subtotal, total, session, finalChannel, finalFulfillment, finalShipping, deliveryNotes
    );

    for (Object[] row : rows) {
      Item i = (Item) row[0];
      BigDecimal price = (BigDecimal) row[1];
      BigDecimal line = (BigDecimal) row[2];
      BigDecimal cost = (BigDecimal) row[3];

      jdbc.update(
          "insert into sale_items(sale_id, tenant_id, product_id, quantity, unit_price, line_total, cost_price) values(?,?,?,?,?,?,?)",
          id, t, i.productId(), i.quantity(), price, line, cost
      );

      int n = jdbc.update(
          "update product_stock set stock=stock-? where product_id=? and branch_id=? and stock>=?",
          i.quantity(), i.productId(), b, i.quantity()
      );
      if (n != 1) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Stock insuficiente");

      jdbc.update(
          "insert into inventory_movements(tenant_id, branch_id, product_id, type, quantity, reason, created_by) values(?,?,?,?,?,?,?)",
          t, b, i.productId(), "OUT", i.quantity(), "Venta " + id, u
      );
    }

    for (Payment p : payments) {
      String m = p.method().toUpperCase(Locale.ROOT);
      if (!Set.of("CASH", "CARD", "TRANSFER", "OTHER").contains(m)) {
        throw new IllegalArgumentException("método de pago inválido: " + m);
      }
      jdbc.update(
          "insert into payments(sale_id, tenant_id, payment_method, amount) values(?,?,?,?)",
          id, t, m, p.amount()
      );
      if (session != null && "CASH".equals(m)) {
        jdbc.update(
            "insert into cash_movements(tenant_id, session_id, branch_id, type, payment_method, amount, reason, sale_id, created_by) values(?,?,?,'SALE_CASH',?,?,?,?,?)",
            t, session, b, m, p.amount(), "Venta " + id, id, u
        );
      }
    }

    if ("DELIVERY".equals(finalFulfillment) && delivery != null) {
      UUID deliveryId = UUID.randomUUID();
      jdbc.update(
          "insert into deliveries(id, tenant_id, sale_id, customer_id, branch_id, status, courier, address, recipient_name, recipient_phone, delivery_notes, shipping_cost) " +
          "values(?,?,?,?,?,'PENDING',?,?,?,?,?,?)",
          deliveryId, t, id, customerId, b,
          delivery.courier(), delivery.address(), delivery.recipientName(), delivery.recipientPhone(), delivery.notes(), finalShipping
      );
    }

    if (warranty > 0) {
      for (Object[] row : rows) {
        jdbc.update(
            "insert into warranties(tenant_id, sale_id, product_id, customer_id, expires_at, terms) values(?,?,?,?,now()+(? * interval '1 day'),?)",
            t, id, ((Item) row[0]).productId(), customerId, warranty, "Garantía de " + warranty + " días registrada en la venta"
        );
      }
    }

    return jdbc.queryForObject(
        "select id, tenant_id, branch_id, user_id, subtotal, tax, total, status, created_at from sales where id=?",
        (r, n) -> new Sale(
            r.getObject(1, UUID.class),
            r.getObject(2, UUID.class),
            r.getObject(3, UUID.class),
            r.getObject(4, UUID.class),
            r.getBigDecimal(5),
            r.getBigDecimal(6),
            r.getBigDecimal(7),
            r.getString(8),
            r.getTimestamp(9).toInstant()
        ),
        id
    );
  }

  public List<Sale> list(UUID t, UUID b) {
    tenant(t);
    return jdbc.query(
        "select id, tenant_id, branch_id, user_id, subtotal, tax, total, status, created_at from sales where tenant_id=? and (? is null or branch_id=?) order by created_at desc",
        (r, n) -> new Sale(
            r.getObject(1, UUID.class),
            r.getObject(2, UUID.class),
            r.getObject(3, UUID.class),
            r.getObject(4, UUID.class),
            r.getBigDecimal(5),
            r.getBigDecimal(6),
            r.getBigDecimal(7),
            r.getString(8),
            r.getTimestamp(9).toInstant()
        ),
        t, b, b
    );
  }
}
