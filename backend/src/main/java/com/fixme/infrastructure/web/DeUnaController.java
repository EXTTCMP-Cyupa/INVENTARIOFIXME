package com.fixme.infrastructure.web;

import com.fixme.application.DeUnaPaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
public class DeUnaController {

  private final DeUnaPaymentService deUnaService;
  private final JdbcTemplate db;

  public DeUnaController(DeUnaPaymentService deUnaService, JdbcTemplate db) {
    this.deUnaService = deUnaService;
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  // --- 1. INTERNAL / POS & ADMINISTRATION ENDPOINTS ---

  @GetMapping("/api/payments/deuna/config")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> getConfig(@AuthenticationPrincipal Jwt jwt) {
    UUID t = tenant(jwt);
    return ResponseEntity.ok(deUnaService.getConfig(t));
  }

  @PutMapping("/api/payments/deuna/config")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> updateConfig(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, Object> req
  ) {
    UUID t = tenant(jwt);
    return ResponseEntity.ok(deUnaService.updateConfig(t, req));
  }

  public record PosDeUnaQrInput(
      BigDecimal amount,
      UUID branchId,
      UUID quoteId,
      UUID saleId,
      String customerName,
      String customerPhone
  ) {}

  @PostMapping("/api/payments/deuna/qr")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> createPosQr(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody PosDeUnaQrInput in
  ) {
    UUID t = tenant(jwt);
    UUID b = in.branchId();
    if (b == null) {
      try {
        b = db.queryForObject("SELECT id FROM branches WHERE tenant_id = ? AND active = true ORDER BY created_at ASC LIMIT 1", UUID.class, t);
      } catch (Exception ignored) {}
    }

    var res = deUnaService.createQr(t, b, new DeUnaPaymentService.CreateDeUnaQrRequest(
        in.amount(),
        in.quoteId() != null ? "QUOTE" : "POS_SALE",
        in.quoteId(),
        in.saleId(),
        in.customerName(),
        in.customerPhone()
    ));

    return ResponseEntity.ok(res);
  }

  @GetMapping("/api/payments/deuna/status/{transactionId}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> checkStatusInternal(@PathVariable String transactionId) {
    return ResponseEntity.ok(deUnaService.checkStatus(transactionId));
  }

  public record SimulateInput(String payerPhone) {}

  @PostMapping("/api/payments/deuna/simulate/{transactionId}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> simulateSuccessInternal(
      @PathVariable String transactionId,
      @RequestBody(required = false) SimulateInput in
  ) {
    String phone = in != null ? in.payerPhone() : null;
    return ResponseEntity.ok(deUnaService.simulateSuccess(transactionId, phone));
  }

  // --- 2. PUBLIC CLIENT & WEBHOOK ENDPOINTS ---

  @PostMapping("/api/public/quotes/{token}/deuna/qr")
  public ResponseEntity<Map<String, Object>> createPublicQuoteQr(@PathVariable String token) {
    return ResponseEntity.ok(deUnaService.createQrForPublicQuote(token));
  }

  @GetMapping("/api/public/payments/deuna/status/{transactionId}")
  public ResponseEntity<Map<String, Object>> checkStatusPublic(@PathVariable String transactionId) {
    return ResponseEntity.ok(deUnaService.checkStatus(transactionId));
  }

  @PostMapping("/api/public/payments/deuna/simulate/{transactionId}")
  public ResponseEntity<Map<String, Object>> simulateSuccessPublic(
      @PathVariable String transactionId,
      @RequestBody(required = false) SimulateInput in
  ) {
    String phone = in != null ? in.payerPhone() : null;
    return ResponseEntity.ok(deUnaService.simulateSuccess(transactionId, phone));
  }

  @PostMapping("/api/public/payments/deuna/webhook")
  public ResponseEntity<Map<String, Object>> receiveWebhook(@RequestBody Map<String, Object> payload) {
    return ResponseEntity.ok(deUnaService.handleWebhook(payload));
  }
}

