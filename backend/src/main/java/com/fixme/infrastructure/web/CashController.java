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

  public CashController(CashService s, org.springframework.jdbc.core.JdbcTemplate d) {
    this.service = s;
    this.db = d;
  }

  public record Open(BigDecimal openingCash, Map<String, BigDecimal> amounts) {}
  public record Movement(String type, String paymentMethod, BigDecimal amount, String reason, String destination, String reference) {}
  public record Close(Map<String, BigDecimal> counted, String depositDestination, String depositReference, BigDecimal depositAmount, BigDecimal nextDayFund) {}
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
    return service.open(tenant(j), branchId, uid(j), x.openingCash(), x.amounts());
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
        "select type, payment_method, amount, reason, destination, reference, created_at from cash_movements where tenant_id=? and session_id=? order by created_at desc",
        t, s.id()
    );
    summary.put("recentMovements", movs);

    BigDecimal salesCash = BigDecimal.ZERO;
    BigDecimal inflowsCash = BigDecimal.ZERO;
    BigDecimal outflowsCash = BigDecimal.ZERO;
    BigDecimal depositsCash = BigDecimal.ZERO;

    for (Map<String, Object> m : movs) {
      String type = (String) m.get("type");
      String method = (String) m.get("payment_method");
      BigDecimal amount = (BigDecimal) m.get("amount");
      if ("CASH".equalsIgnoreCase(method) && amount != null) {
        if ("SALE_CASH".equalsIgnoreCase(type)) salesCash = salesCash.add(amount);
        else if ("CASH_IN".equalsIgnoreCase(type)) inflowsCash = inflowsCash.add(amount);
        else if ("CASH_OUT".equalsIgnoreCase(type)) outflowsCash = outflowsCash.add(amount);
        else if ("DEPOSIT".equalsIgnoreCase(type)) depositsCash = depositsCash.add(amount);
      }
    }

    BigDecimal currentDrawer = s.openingCash().add(salesCash).add(inflowsCash).subtract(outflowsCash).subtract(depositsCash);
    summary.put("salesCash", salesCash);
    summary.put("inflowsCash", inflowsCash);
    summary.put("outflowsCash", outflowsCash);
    summary.put("depositsCash", depositsCash);
    summary.put("cashInDrawer", currentDrawer);

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
  @PreAuthorize("hasAnyAuthority('SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public CashPort.Session close(@AuthenticationPrincipal Jwt j, @RequestParam UUID branchId, @RequestBody Close x) {
    return service.close(
        tenant(j), branchId, uid(j), x.counted(),
        x.depositDestination(), x.depositReference(), x.depositAmount(), x.nextDayFund()
    );
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
