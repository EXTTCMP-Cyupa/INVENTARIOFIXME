package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/receivables")
public class CustomerReceivableController {
  private final JdbcTemplate db;

  public CustomerReceivableController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String email) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
    return db.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, email);
  }

  public record PayInput(BigDecimal amount, String paymentMethod, String reference, String notes) {}

  @GetMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public List<Map<String, Object>> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId,
      @RequestParam(required = false) UUID customerId,
      @RequestParam(required = false) String status
  ) {
    UUID t = tenant(jwt);
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    StringBuilder sql = new StringBuilder("""
        SELECT r.id, r.branch_id, r.customer_id, r.sale_id, r.work_order_id,
               r.folio, r.description, r.total_amount, r.paid_amount, r.balance_due,
               r.status, r.due_date, r.created_at, r.updated_at,
               c.name AS customer_name, c.identification_number AS customer_id_num,
               c.phone AS customer_phone, c.email AS customer_email,
               b.name AS branch_name,
               u.full_name AS created_by_name
        FROM customer_receivables r
        JOIN customers c ON c.id = r.customer_id
        LEFT JOIN branches b ON b.id = r.branch_id
        LEFT JOIN app_users u ON u.id = r.created_by
        WHERE r.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (branchId != null) {
      sql.append(" AND r.branch_id = ?");
      params.add(branchId);
    }
    if (customerId != null) {
      sql.append(" AND r.customer_id = ?");
      params.add(customerId);
    }
    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      sql.append(" AND r.status = ?");
      params.add(status.toUpperCase(Locale.ROOT));
    }

    sql.append(" ORDER BY r.created_at DESC");
    return db.queryForList(sql.toString(), params.toArray());
  }

  @GetMapping("/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_ACCOUNTANT')")
  public Map<String, Object> getById(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    UUID t = tenant(jwt);
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    var recList = db.queryForList("""
        SELECT r.id, r.branch_id, r.customer_id, r.sale_id, r.work_order_id,
               r.folio, r.description, r.total_amount, r.paid_amount, r.balance_due,
               r.status, r.due_date, r.created_at, r.updated_at,
               c.name AS customer_name, c.identification_number AS customer_id_num,
               c.phone AS customer_phone, c.email AS customer_email,
               b.name AS branch_name
        FROM customer_receivables r
        JOIN customers c ON c.id = r.customer_id
        LEFT JOIN branches b ON b.id = r.branch_id
        WHERE r.tenant_id = ? AND r.id = ?
        """, t, id);

    if (recList.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta por cobrar no encontrada");
    }

    Map<String, Object> out = new LinkedHashMap<>(recList.get(0));

    var payments = db.queryForList("""
        SELECT p.id, p.amount, p.payment_method, p.reference, p.notes, p.created_at,
               u.full_name AS received_by_name
        FROM customer_receivable_payments p
        LEFT JOIN app_users u ON u.id = p.received_by
        WHERE p.tenant_id = ? AND p.receivable_id = ?
        ORDER BY p.created_at DESC
        """, t, id);

    out.put("payments", payments);
    return out;
  }

  @PostMapping("/{id}/pay")
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER')")
  public Map<String, Object> pay(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody PayInput in
  ) {
    UUID t = tenant(jwt);
    UUID u = user(t, jwt.getSubject());
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    if (in.amount() == null || in.amount().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El monto del abono debe ser mayor a cero");
    }

    var recList = db.queryForList(
        "SELECT id, branch_id, customer_id, folio, total_amount, paid_amount, balance_due, status FROM customer_receivables WHERE tenant_id = ? AND id = ? FOR UPDATE",
        t, id
    );
    if (recList.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cuenta por cobrar no encontrada");
    }

    Map<String, Object> rec = recList.get(0);
    UUID branchId = (UUID) rec.get("branch_id");
    String folio = (String) rec.get("folio");
    BigDecimal total = new BigDecimal(rec.get("total_amount").toString());
    BigDecimal paid = new BigDecimal(rec.get("paid_amount").toString());
    BigDecimal due = new BigDecimal(rec.get("balance_due").toString());

    if (due.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta cuenta por cobrar ya está totalmente liquidada");
    }

    BigDecimal payAmount = in.amount().min(due);

    // Exigir caja abierta en la sucursal para recibir el abono
    List<Map<String, Object>> openSessions = db.queryForList(
        "SELECT id FROM cash_sessions WHERE tenant_id = ? AND branch_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1",
        t, branchId
    );
    if (openSessions.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Debe abrir la caja en esta sucursal antes de registrar un abono.");
    }
    UUID sessionId = (UUID) openSessions.get(0).get("id");

    String method = (in.paymentMethod() != null && !in.paymentMethod().isBlank())
        ? in.paymentMethod().toUpperCase(Locale.ROOT)
        : "CASH";

    // 1. Registrar el pago
    UUID paymentId = UUID.randomUUID();
    db.update("""
        INSERT INTO customer_receivable_payments(id, tenant_id, branch_id, receivable_id, cash_session_id, amount, payment_method, reference, notes, received_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        paymentId, t, branchId, id, sessionId, payAmount, method, in.reference(), in.notes(), u
    );

    // 2. Actualizar el saldo
    BigDecimal newPaid = paid.add(payAmount);
    BigDecimal newDue = total.subtract(newPaid).max(BigDecimal.ZERO);
    String newStatus = newDue.compareTo(BigDecimal.ZERO) <= 0 ? "PAID" : "PARTIALLY_PAID";

    db.update("""
        UPDATE customer_receivables
        SET paid_amount = ?, balance_due = ?, status = ?, updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        newPaid, newDue, newStatus, id, t
    );

    // 3. Registrar movimiento en caja
    db.update("""
        INSERT INTO cash_movements(tenant_id, session_id, branch_id, type, payment_method, amount, reason, created_by, reference)
        VALUES(?, ?, ?, 'SALE_CASH', ?, ?, ?, ?, ?)
        """,
        t, sessionId, branchId, method, payAmount, "Abono Crédito #" + folio, u, "REC-" + folio
    );

    // 4. Registrar en bitácora de auditoría
    try {
      db.update("""
          INSERT INTO activity_logs(tenant_id, branch_id, user_id, action, entity_type, entity_id, details)
          VALUES(?, ?, ?, 'RECEIVABLE_PAY', 'RECEIVABLE', ?, ?)
          """,
          t, branchId, u, id.toString(), "Abono de $" + payAmount + " (" + method + ") a cuenta #" + folio + ". Saldo restante: $" + newDue
      );
    } catch (Exception ignored) {}

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("success", true);
    resp.put("paidAmount", payAmount);
    resp.put("newBalanceDue", newDue);
    resp.put("newStatus", newStatus);
    return resp;
  }
}

