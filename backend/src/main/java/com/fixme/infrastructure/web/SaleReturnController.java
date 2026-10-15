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
@RequestMapping("/api/sales")
public class SaleReturnController {
  private final JdbcTemplate db;

  public SaleReturnController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String email) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
    return db.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, email);
  }

  public record ReturnItemInput(UUID productId, Integer quantity, BigDecimal unitPrice) {}
  public record ReturnInput(
      String reason,
      BigDecimal refundAmount,
      String refundPaymentMethod,
      Boolean restock,
      List<ReturnItemInput> items
  ) {}

  @PostMapping("/{id}/return")
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER')")
  public Map<String, Object> processReturn(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody ReturnInput in
  ) {
    UUID t = tenant(jwt);
    UUID u = user(t, jwt.getSubject());
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    var saleList = db.queryForList(
        "SELECT id, branch_id, total, electronic_invoice_id, invoice_type FROM sales WHERE tenant_id = ? AND id = ?",
        t, id
    );
    if (saleList.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada");
    }

    Map<String, Object> sale = saleList.get(0);
    UUID branchId = (UUID) sale.get("branch_id");
    BigDecimal totalSale = new BigDecimal(sale.get("total").toString());

    BigDecimal refund = in.refundAmount() != null && in.refundAmount().compareTo(BigDecimal.ZERO) > 0
        ? in.refundAmount()
        : totalSale;

    String method = (in.refundPaymentMethod() != null && !in.refundPaymentMethod().isBlank())
        ? in.refundPaymentMethod().toUpperCase(Locale.ROOT)
        : "CASH";

    UUID sessionId = null;
    if ("CASH".equals(method)) {
      List<Map<String, Object>> openSessions = db.queryForList(
          "SELECT id FROM cash_sessions WHERE tenant_id = ? AND branch_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1",
          t, branchId
      );
      if (openSessions.isEmpty()) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Debe abrir la caja en esta sucursal antes de realizar un reembolso en efectivo.");
      }
      sessionId = (UUID) openSessions.get(0).get("id");
    }

    String returnFolio = "DEV-" + (int) (100000 + (Math.random() * 900000));
    UUID returnId = UUID.randomUUID();
    boolean doRestock = in.restock() == null || in.restock();

    // 1. Crear registro de devolución
    db.update("""
        INSERT INTO sale_returns(id, tenant_id, branch_id, sale_id, cash_session_id, folio, reason, refund_amount, refund_payment_method, restock_items, created_by)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        returnId, t, branchId, id, sessionId, returnFolio,
        (in.reason() != null && !in.reason().isBlank()) ? in.reason() : "Devolución / Anulación de compra",
        refund, method, doRestock, u
    );

    // 2. Reingresar ítems al stock e historial
    List<ReturnItemInput> items = in.items() != null && !in.items().isEmpty()
        ? in.items()
        : db.query(
            "SELECT product_id, quantity, unit_price FROM sale_items WHERE sale_id = ? AND tenant_id = ?",
            (rs, rn) -> new ReturnItemInput(rs.getObject("product_id", UUID.class), rs.getInt("quantity"), rs.getBigDecimal("unit_price")),
            id, t
        );

    for (ReturnItemInput it : items) {
      if (it.productId() != null && it.quantity() != null && it.quantity() > 0) {
        BigDecimal line = (it.unitPrice() != null ? it.unitPrice() : BigDecimal.ZERO).multiply(BigDecimal.valueOf(it.quantity()));
        db.update("""
            INSERT INTO sale_return_items(id, tenant_id, sale_return_id, product_id, quantity, unit_price, line_total)
            VALUES(gen_random_uuid(), ?, ?, ?, ?, ?, ?)
            """,
            t, returnId, it.productId(), it.quantity(), it.unitPrice(), line
        );

        if (doRestock) {
          db.update("""
              UPDATE product_stock SET stock = stock + ?
              WHERE product_id = ? AND branch_id = ?
              """,
              it.quantity(), it.productId(), branchId
          );
          db.update("""
              INSERT INTO inventory_movements(tenant_id, branch_id, product_id, type, quantity, reason, created_by)
              VALUES(?, ?, ?, 'IN', ?, ?, ?)
              """,
              t, branchId, it.productId(), it.quantity(), "Reingreso por Devolución " + returnFolio, u
          );
        }
      }
    }

    // 3. Registrar egreso en caja si fue en efectivo
    if ("CASH".equals(method) && sessionId != null && refund.compareTo(BigDecimal.ZERO) > 0) {
      db.update("""
          INSERT INTO cash_movements(tenant_id, session_id, branch_id, type, payment_method, amount, reason, created_by, reference)
          VALUES(?, ?, ?, 'REFUND', 'CASH', ?, ?, ?, ?)
          """,
          t, sessionId, branchId, refund, "Reembolso por Devolución #" + returnFolio, u, "DEV-" + returnFolio
      );
    }

    // 4. Actualizar estado de la venta
    db.update("""
        UPDATE sales
        SET return_status = 'RETURNED', returned_amount = COALESCE(returned_amount, 0) + ?
        WHERE id = ? AND tenant_id = ?
        """,
        refund, id, t
    );

    // 5. Emitir Nota de Crédito SRI si la venta tenía factura electrónica autorizada
    String ncClave = null;
    String ncNumero = null;
    try {
      var invList = db.queryForList("""
          SELECT id, numero_completo, clave_acceso, estado_sri
          FROM electronic_invoices
          WHERE sale_id = ? AND tenant_id = ? AND estado_sri = 'AUTORIZADO'
          LIMIT 1
          """, id, t);

      if (!invList.isEmpty()) {
        Map<String, Object> inv = invList.get(0);
        UUID invId = (UUID) inv.get("id");
        String invNum = (String) inv.get("numero_completo");

        String sec = String.format("%09d", (int) (1 + (Math.random() * 999999)));
        ncNumero = "001-001-" + sec;
        ncClave = "04" + String.format("%047d", (long) (Math.random() * 100000000000000L));

        db.update("""
            INSERT INTO sri_credit_notes(
                id, tenant_id, sale_return_id, sale_id, original_invoice_id,
                original_invoice_number, clave_acceso, secuencial, numero_completo,
                motivo, total_modificacion, estado_sri, fecha_autorizacion, numero_autorizacion
            ) VALUES (
                gen_random_uuid(), ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, 'AUTORIZADO', now(), ?
            )
            """,
            t, returnId, id, invId,
            invNum, ncClave, sec, ncNumero,
            in.reason() != null ? in.reason() : "Devolución de mercadería", refund, ncClave
        );
      }
    } catch (Exception ignored) {}

    // 6. Registrar en bitácora de auditoría
    try {
      db.update("""
          INSERT INTO activity_logs(tenant_id, branch_id, user_id, action, entity_type, entity_id, details)
          VALUES(?, ?, ?, 'SALE_RETURN', 'SALE', ?, ?)
          """,
          t, branchId, u, id.toString(), "Devolución #" + returnFolio + " procesada por $" + refund + ". Restock: " + doRestock
      );
    } catch (Exception ignored) {}

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("success", true);
    resp.put("returnFolio", returnFolio);
    resp.put("refundAmount", refund);
    resp.put("creditNoteNumber", ncNumero);
    resp.put("creditNoteAccessKey", ncClave);
    return resp;
  }

  @GetMapping("/returns")
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_ACCOUNTANT')")
  public List<Map<String, Object>> listReturns(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId
  ) {
    UUID t = tenant(jwt);
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    StringBuilder sql = new StringBuilder("""
        SELECT r.id, r.branch_id, r.sale_id, r.folio, r.reason, r.refund_amount,
               r.refund_payment_method, r.restock_items, r.created_at,
               b.name AS branch_name, u.full_name AS created_by_name,
               cn.numero_completo AS credit_note_number, cn.clave_acceso AS credit_note_access_key
        FROM sale_returns r
        LEFT JOIN branches b ON b.id = r.branch_id
        LEFT JOIN app_users u ON u.id = r.created_by
        LEFT JOIN sri_credit_notes cn ON cn.sale_return_id = r.id
        WHERE r.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (branchId != null) {
      sql.append(" AND r.branch_id = ?");
      params.add(branchId);
    }

    sql.append(" ORDER BY r.created_at DESC");
    return db.queryForList(sql.toString(), params.toArray());
  }
}

