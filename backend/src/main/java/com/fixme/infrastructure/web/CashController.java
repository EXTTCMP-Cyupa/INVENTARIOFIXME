package com.fixme.infrastructure.web;

import com.fixme.application.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cash")
public class CashController {
  private final CashService service;
  private final org.springframework.jdbc.core.JdbcTemplate db;
  private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

  public CashController(CashService s, org.springframework.jdbc.core.JdbcTemplate d) {
    this.service = s;
    this.db = d;
  }

  public record Open(BigDecimal openingCash, Map<String, BigDecimal> amounts) {}
  public record Movement(String type, String paymentMethod, BigDecimal amount, String reason, String destination, String reference) {}
  public record Close(
      Map<String, BigDecimal> counted,
      String depositDestination,
      String depositReference,
      BigDecimal depositAmount,
      BigDecimal nextDayFund,
      Map<String, Object> countedBreakdown,
      Map<String, Object> bankBalances
  ) {}
  public record DepositInput(BigDecimal amount, String destination, String reference, String reason) {}

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String e) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
    return db.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, e);
  }

  private UUID uid(Jwt j) {
    return user(tenant(j), j.getSubject());
  }

  @PostMapping("/open")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public CashPort.Session open(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId, @RequestBody Open x) {
    CashPort.Session s = service.open(tenant(j), branchId, uid(j), x.openingCash(), x.amounts());
    try {
      db.update(
          "INSERT INTO activity_logs(tenant_id, branch_id, user_id, action, entity_type, entity_id, details) VALUES(?, ?, ?, 'CASH_OPEN', 'CASH_SESSION', ?, ?)",
          tenant(j), branchId, uid(j), s.id().toString(), "Apertura de turno con fondo inicial de $" + x.openingCash()
      );
    } catch (Exception ignored) {}
    return s;
  }

  @GetMapping("/current")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> current(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId) {
    UUID t = tenant(j);
    Optional<CashPort.Session> opt = service.current(t, branchId);
    if (opt.isEmpty()) return Map.of();

    CashPort.Session s = opt.get();
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    // Calculate detailed breakdown
    Map<String, Object> summary = new HashMap<>();
    summary.put("id", s.id());
    summary.put("branchId", s.branchId());
    summary.put("status", s.status());
    summary.put("openingCash", s.openingCash());
    summary.put("openedAt", s.openedAt());
    summary.put("expected", s.expected());
    summary.put("counted", s.counted());
    summary.put("difference", s.difference());
    summary.put("closeState", s.closeState());
    summary.put("depositDestination", s.depositDestination());
    summary.put("depositReference", s.depositReference());
    summary.put("depositAmount", s.depositAmount());
    summary.put("nextDayFund", s.nextDayFund());

    List<Map<String, Object>> movs = db.queryForList(
        "select id, session_id, sale_id, type, payment_method, amount, reason, destination, reference, created_at from cash_movements where tenant_id=? and session_id=? order by created_at desc",
        t, s.id()
    );
    summary.put("recentMovements", movs);

    BigDecimal movPosCash = BigDecimal.ZERO;
    BigDecimal movPosCard = BigDecimal.ZERO;
    BigDecimal movPosTransfer = BigDecimal.ZERO;
    BigDecimal movPosOther = BigDecimal.ZERO;

    BigDecimal movWoCash = BigDecimal.ZERO;
    BigDecimal movWoCard = BigDecimal.ZERO;
    BigDecimal movWoTransfer = BigDecimal.ZERO;
    BigDecimal movWoOther = BigDecimal.ZERO;

    BigDecimal manualInCash = BigDecimal.ZERO;
    BigDecimal outflowsCash = BigDecimal.ZERO;
    BigDecimal depositsCash = BigDecimal.ZERO;
    BigDecimal refundsCash = BigDecimal.ZERO;

    for (Map<String, Object> m : movs) {
      String type = (String) m.get("type");
      String method = m.get("payment_method") != null ? ((String) m.get("payment_method")).toUpperCase(Locale.ROOT) : "CASH";
      BigDecimal amt = m.get("amount") != null ? new BigDecimal(m.get("amount").toString()) : BigDecimal.ZERO;
      String ref = (String) m.get("reference");
      String reason = (String) m.get("reason");
      Object saleId = m.get("sale_id");

      boolean isWo = (ref != null && ref.toUpperCase(Locale.ROOT).startsWith("OT-"))
          || (saleId == null && reason != null && (reason.toLowerCase().contains("orden de servicio") || reason.toLowerCase().contains("reparac")));

      if ("SALE_CASH".equalsIgnoreCase(type)) {
        if (isWo) {
          if ("CASH".equals(method)) movWoCash = movWoCash.add(amt);
          else if ("CARD".equals(method)) movWoCard = movWoCard.add(amt);
          else if ("TRANSFER".equals(method)) movWoTransfer = movWoTransfer.add(amt);
          else movWoOther = movWoOther.add(amt);
        } else {
          if ("CASH".equals(method)) movPosCash = movPosCash.add(amt);
          else if ("CARD".equals(method)) movPosCard = movPosCard.add(amt);
          else if ("TRANSFER".equals(method)) movPosTransfer = movPosTransfer.add(amt);
          else movPosOther = movPosOther.add(amt);
        }
      } else if ("CASH_IN".equalsIgnoreCase(type)) {
        manualInCash = manualInCash.add(amt);
      } else if ("CASH_OUT".equalsIgnoreCase(type)) {
        outflowsCash = outflowsCash.add(amt);
      } else if ("DEPOSIT".equalsIgnoreCase(type)) {
        depositsCash = depositsCash.add(amt);
      } else if ("REFUND".equalsIgnoreCase(type)) {
        refundsCash = refundsCash.add(amt);
      }
    }

    // Direct query for Work Orders delivered or collected during this session
    List<Map<String, Object>> sessionWorkOrders = db.queryForList("""
        SELECT w.id, w.order_number, w.description, w.payment_method, COALESCE(w.payment_amount, 0.00) AS payment_amount, w.paid_at, w.status
        FROM work_orders w
        WHERE w.tenant_id = ? AND (w.cash_session_id = ? OR (w.branch_id = ? AND w.paid_at >= ?))
          AND w.paid_at IS NOT NULL
        """, t, s.id(), s.branchId(), java.sql.Timestamp.from(s.openedAt()));

    BigDecimal directWoCash = BigDecimal.ZERO;
    BigDecimal directWoCard = BigDecimal.ZERO;
    BigDecimal directWoTransfer = BigDecimal.ZERO;
    BigDecimal directWoOther = BigDecimal.ZERO;

    for (Map<String, Object> wo : sessionWorkOrders) {
      String pm = wo.get("payment_method") != null ? wo.get("payment_method").toString().toUpperCase(Locale.ROOT) : "CASH";
      BigDecimal amt = wo.get("payment_amount") != null ? new BigDecimal(wo.get("payment_amount").toString()) : BigDecimal.ZERO;
      if ("CASH".equals(pm)) directWoCash = directWoCash.add(amt);
      else if ("CARD".equals(pm)) directWoCard = directWoCard.add(amt);
      else if ("TRANSFER".equals(pm)) directWoTransfer = directWoTransfer.add(amt);
      else directWoOther = directWoOther.add(amt);
    }

    BigDecimal woCash = directWoCash.max(movWoCash);
    BigDecimal woCard = directWoCard.max(movWoCard);
    BigDecimal woTransfer = directWoTransfer.max(movWoTransfer);
    BigDecimal woOther = directWoOther.max(movWoOther);

    // Fiscal and Comprobante Reconciliation
    List<Map<String, Object>> sessionSales = db.queryForList("""
        SELECT s.id, s.subtotal, COALESCE(s.discount, 0.00) AS discount, s.tax, s.total, s.created_at,
               COALESCE(s.electronic_invoice_id, (SELECT ei2.id FROM electronic_invoices ei2 WHERE ei2.sale_id = s.id ORDER BY ei2.created_at DESC LIMIT 1)) AS sri_invoice_id
        FROM sales s
        WHERE s.tenant_id = ? AND (s.cash_session_id = ? OR (s.branch_id = ? AND s.created_at >= ?))
          AND s.status = 'COMPLETED'
        """, t, s.id(), s.branchId(), java.sql.Timestamp.from(s.openedAt()));

    int totalSalesCount = sessionSales.size();
    BigDecimal totalSalesAmount = BigDecimal.ZERO;
    int ticketSalesCount = 0;
    BigDecimal ticketSalesAmount = BigDecimal.ZERO;
    int sriSalesCount = 0;
    BigDecimal sriSalesAmount = BigDecimal.ZERO;
    BigDecimal sriSubtotal15 = BigDecimal.ZERO;
    BigDecimal sriSubtotal0 = BigDecimal.ZERO;
    BigDecimal sriIva15 = BigDecimal.ZERO;

    List<UUID> sriInvoiceIds = new ArrayList<>();
    for (Map<String, Object> sl : sessionSales) {
      BigDecimal tot = sl.get("total") != null ? new BigDecimal(sl.get("total").toString()) : BigDecimal.ZERO;
      totalSalesAmount = totalSalesAmount.add(tot);

      Object sriId = sl.get("sri_invoice_id");
      if (sriId != null) {
        sriSalesCount++;
        sriSalesAmount = sriSalesAmount.add(tot);
        if (sriId instanceof UUID u) sriInvoiceIds.add(u);
        else {
          try { sriInvoiceIds.add(UUID.fromString(sriId.toString())); } catch (Exception ignored) {}
        }
      } else {
        ticketSalesCount++;
        ticketSalesAmount = ticketSalesAmount.add(tot);
      }
    }

    if (!sriInvoiceIds.isEmpty()) {
      try {
        List<Map<String, Object>> invRows = db.queryForList("""
            SELECT COALESCE(SUM(subtotal_15), 0) AS sum_sub15,
                   COALESCE(SUM(subtotal_0), 0) AS sum_sub0,
                   COALESCE(SUM(iva_15), 0) AS sum_iva15
            FROM electronic_invoices
            WHERE tenant_id = ? AND id = ANY(?)
            """, t, sriInvoiceIds.toArray(new UUID[0]));
        if (!invRows.isEmpty()) {
          Map<String, Object> ir = invRows.get(0);
          if (ir.get("sum_sub15") != null) sriSubtotal15 = new BigDecimal(ir.get("sum_sub15").toString());
          if (ir.get("sum_sub0") != null) sriSubtotal0 = new BigDecimal(ir.get("sum_sub0").toString());
          if (ir.get("sum_iva15") != null) sriIva15 = new BigDecimal(ir.get("sum_iva15").toString());
        }
      } catch (Exception ignored) {}
    }

    Map<String, Object> fiscalSummary = new LinkedHashMap<>();
    fiscalSummary.put("totalSalesCount", totalSalesCount);
    fiscalSummary.put("totalSalesAmount", totalSalesAmount);
    fiscalSummary.put("ticketSalesCount", ticketSalesCount);
    fiscalSummary.put("ticketSalesAmount", ticketSalesAmount);
    fiscalSummary.put("sriSalesCount", sriSalesCount);
    fiscalSummary.put("sriSalesAmount", sriSalesAmount);
    fiscalSummary.put("sriSubtotal15", sriSubtotal15);
    fiscalSummary.put("sriSubtotal0", sriSubtotal0);
    fiscalSummary.put("sriIva15", sriIva15);
    summary.put("fiscalSummary", fiscalSummary);

    // Payments by Method Summary from POS sales
    List<Map<String, Object>> payRows = db.queryForList("""
        SELECT p.payment_method, COALESCE(SUM(p.amount), 0) AS total_amount, COUNT(p.id) AS payment_count
        FROM payments p
        JOIN sales s ON s.id = p.sale_id
        WHERE s.tenant_id = ? AND (s.cash_session_id = ? OR (s.branch_id = ? AND s.created_at >= ?))
          AND s.status = 'COMPLETED'
        GROUP BY p.payment_method
        """, t, s.id(), s.branchId(), java.sql.Timestamp.from(s.openedAt()));

    BigDecimal posPaidCash = BigDecimal.ZERO;
    BigDecimal posPaidCard = BigDecimal.ZERO;
    BigDecimal posPaidTransfer = BigDecimal.ZERO;
    BigDecimal posPaidOther = BigDecimal.ZERO;

    for (Map<String, Object> pr : payRows) {
      String pm = (String) pr.get("payment_method");
      BigDecimal amt = pr.get("total_amount") != null ? new BigDecimal(pr.get("total_amount").toString()) : BigDecimal.ZERO;
      if ("CASH".equalsIgnoreCase(pm)) posPaidCash = posPaidCash.add(amt);
      else if ("CARD".equalsIgnoreCase(pm)) posPaidCard = posPaidCard.add(amt);
      else if ("TRANSFER".equalsIgnoreCase(pm)) posPaidTransfer = posPaidTransfer.add(amt);
      else posPaidOther = posPaidOther.add(amt);
    }

    BigDecimal posCash = posPaidCash.max(movPosCash);
    BigDecimal posCard = posPaidCard.max(movPosCard);
    BigDecimal posTransfer = posPaidTransfer.max(movPosTransfer);
    BigDecimal posOther = posPaidOther.max(movPosOther);

    // Breakdowns
    Map<String, Object> salesBreakdown = new LinkedHashMap<>();
    salesBreakdown.put("cash", posCash);
    salesBreakdown.put("card", posCard);
    salesBreakdown.put("transfer", posTransfer);
    salesBreakdown.put("other", posOther);
    salesBreakdown.put("total", posCash.add(posCard).add(posTransfer).add(posOther));
    salesBreakdown.put("count", totalSalesCount);
    summary.put("salesBreakdown", salesBreakdown);

    Map<String, Object> workOrdersBreakdown = new LinkedHashMap<>();
    workOrdersBreakdown.put("cash", woCash);
    workOrdersBreakdown.put("card", woCard);
    workOrdersBreakdown.put("transfer", woTransfer);
    workOrdersBreakdown.put("other", woOther);
    workOrdersBreakdown.put("total", woCash.add(woCard).add(woTransfer).add(woOther));
    workOrdersBreakdown.put("count", sessionWorkOrders.size());
    summary.put("workOrdersBreakdown", workOrdersBreakdown);

    Map<String, Object> manualMovements = new LinkedHashMap<>();
    manualMovements.put("inflowsCash", manualInCash);
    manualMovements.put("outflowsCash", outflowsCash);
    manualMovements.put("depositsCash", depositsCash);
    manualMovements.put("refundsCash", refundsCash);
    manualMovements.put("totalOutflows", outflowsCash.add(depositsCash).add(refundsCash));
    summary.put("manualMovements", manualMovements);

    // Consolidated payments across ALL activities (POS + Taller + Entradas)
    BigDecimal totalCashInflows = posCash.add(woCash).add(manualInCash);
    BigDecimal totalCardInflows = posCard.add(woCard);
    BigDecimal totalTransferInflows = posTransfer.add(woTransfer);
    BigDecimal totalOtherInflows = posOther.add(woOther);
    BigDecimal grandTotalRevenue = posCash.add(posCard).add(posTransfer).add(posOther).add(woCash).add(woCard).add(woTransfer).add(woOther);
    BigDecimal grandTotalExpenses = outflowsCash.add(depositsCash).add(refundsCash);

    Map<String, Object> paymentsSummary = new LinkedHashMap<>();
    paymentsSummary.put("cash", posCash.add(woCash));
    paymentsSummary.put("card", totalCardInflows);
    paymentsSummary.put("transfer", totalTransferInflows);
    paymentsSummary.put("other", totalOtherInflows);
    paymentsSummary.put("posTotal", salesBreakdown.get("total"));
    paymentsSummary.put("workOrdersTotal", workOrdersBreakdown.get("total"));
    paymentsSummary.put("total", grandTotalRevenue);
    paymentsSummary.put("grandTotalIncome", grandTotalRevenue.add(manualInCash));
    paymentsSummary.put("grandTotalExpenses", grandTotalExpenses);
    paymentsSummary.put("netBalance", grandTotalRevenue.add(manualInCash).subtract(grandTotalExpenses));
    summary.put("paymentsSummary", paymentsSummary);

    // Cash drawer physical reconciliation
    BigDecimal currentDrawer = s.openingCash().add(totalCashInflows).subtract(grandTotalExpenses);
    summary.put("salesCash", posCash.add(woCash)); // Total sales + workshop cash collected
    summary.put("posSalesCash", posCash);
    summary.put("workOrdersCash", woCash);
    summary.put("inflowsCash", manualInCash);
    summary.put("outflowsCash", outflowsCash);
    summary.put("depositsCash", depositsCash);
    summary.put("refundsCash", refundsCash);
    summary.put("inflows", manualInCash);
    summary.put("outflows", outflowsCash);
    summary.put("deposits", depositsCash);
    summary.put("cashInDrawer", currentDrawer);
    summary.put("currentCashInDrawer", currentDrawer);

    Map<String, Object> drawerReconciliation = new LinkedHashMap<>();
    drawerReconciliation.put("openingCash", s.openingCash());
    drawerReconciliation.put("posSalesCash", posCash);
    drawerReconciliation.put("workOrdersCash", woCash);
    drawerReconciliation.put("manualInCash", manualInCash);
    drawerReconciliation.put("totalCashIn", totalCashInflows);
    drawerReconciliation.put("outflowsCash", outflowsCash);
    drawerReconciliation.put("depositsCash", depositsCash);
    drawerReconciliation.put("refundsCash", refundsCash);
    drawerReconciliation.put("totalCashOut", grandTotalExpenses);
    drawerReconciliation.put("expectedCashInDrawer", currentDrawer);
    summary.put("drawerReconciliation", drawerReconciliation);

    // Stored Physical and Multibank Breakdown (if session closed or previously saved)
    try {
      List<Map<String, Object>> extra = db.queryForList("SELECT counted_breakdown, bank_balances FROM cash_sessions WHERE id = ?", s.id());
      if (!extra.isEmpty()) {
        summary.put("countedBreakdown", extra.get(0).get("counted_breakdown"));
        summary.put("bankBalances", extra.get(0).get("bank_balances"));
      }
    } catch (Exception ignored) {}

    return summary;
  }

  @PostMapping("/movement")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public CashPort.Session movement(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId, @RequestBody Movement x) {
    return service.movement(tenant(j), branchId, uid(j), x.type(), x.paymentMethod(), x.amount(), x.reason(), x.destination(), x.reference());
  }

  @PostMapping("/deposit")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public CashPort.Session deposit(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId, @RequestBody DepositInput x) {
    String reason = x.reason() != null && !x.reason().isBlank() ? x.reason() : "Depósito / Traslado a " + (x.destination() != null ? x.destination() : "Banco");
    return service.movement(tenant(j), branchId, uid(j), "DEPOSIT", "CASH", x.amount(), reason, x.destination(), x.reference());
  }

  @PostMapping("/close")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public CashPort.Session close(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId, @RequestBody Close x) {
    CashPort.Session closed = service.close(
        tenant(j), branchId, uid(j), x.counted(),
        x.depositDestination(), x.depositReference(), x.depositAmount(), x.nextDayFund()
    );

    if (x.countedBreakdown() != null || x.bankBalances() != null) {
      try {
        String countJson = x.countedBreakdown() != null ? mapper.writeValueAsString(x.countedBreakdown()) : null;
        String bankJson = x.bankBalances() != null ? mapper.writeValueAsString(x.bankBalances()) : null;
        db.update("UPDATE cash_sessions SET counted_breakdown = ?::jsonb, bank_balances = ?::jsonb WHERE id = ?",
            countJson, bankJson, closed.id());
      } catch (Exception ignored) {}
    }

    try {
      db.update(
          "INSERT INTO activity_logs(tenant_id, branch_id, user_id, action, entity_type, entity_id, details) VALUES(?, ?, ?, 'CASH_CLOSE', 'CASH_SESSION', ?, ?)",
          tenant(j), branchId, uid(j), closed.id().toString(), "Cierre de turno. Estado: " + closed.closeState() + ", Diferencia: $" + closed.difference()
      );
    } catch (Exception ignored) {}

    return closed;
  }

  @GetMapping("/report")
  @PreAuthorize("hasAnyAuthority('SCOPE_ACCOUNTANT','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public List<CashPort.Session> report(
      @AuthenticationPrincipal Jwt j,
      @RequestParam UUID branchId,
      @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) Instant from,
      @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) Instant to
  ) {
    return service.report(tenant(j), branchId, from, to);
  }

  @GetMapping("/movements")
  @PreAuthorize("hasAnyAuthority('SCOPE_ACCOUNTANT','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  public List<Map<String, Object>> movements(
      @AuthenticationPrincipal Jwt j,
      @RequestParam UUID branchId,
      @RequestParam(required = false) UUID sessionId
  ) {
    UUID t = tenant(j);
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    return sessionId == null
        ? db.queryForList(
            "select id, session_id, type, payment_method, amount, reason, destination, reference, created_at from cash_movements where tenant_id=? and branch_id=? order by created_at desc limit 100",
            t, branchId
        )
        : db.queryForList(
            "select id, session_id, type, payment_method, amount, reason, destination, reference, created_at from cash_movements where tenant_id=? and branch_id=? and session_id=? order by created_at desc",
            t, branchId, sessionId
        );
  }
}
