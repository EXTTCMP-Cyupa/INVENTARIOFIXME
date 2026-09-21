package com.fixme.infrastructure.web;

import com.fixme.application.PayphonePaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
public class PayphoneController {

  private final PayphonePaymentService payphoneService;
  private final JdbcTemplate db;

  public PayphoneController(PayphonePaymentService payphoneService, JdbcTemplate db) {
    this.payphoneService = payphoneService;
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  // --- 1. INTERNAL / POS & ADMINISTRATION ENDPOINTS ---

  @GetMapping("/api/payments/payphone/config")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> getConfig(@AuthenticationPrincipal Jwt jwt) {
    UUID t = tenant(jwt);
    return ResponseEntity.ok(payphoneService.getConfig(t));
  }

  @PutMapping("/api/payments/payphone/config")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> updateConfig(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, Object> req
  ) {
    UUID t = tenant(jwt);
    return ResponseEntity.ok(payphoneService.updateConfig(t, req));
  }

  public record PosPayphoneInput(
      BigDecimal amount,
      BigDecimal tax,
      UUID branchId,
      UUID quoteId,
      UUID saleId,
      String customerEmail,
      String customerPhone
  ) {}

  @PostMapping("/api/payments/payphone/prepare")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> preparePosPayment(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody PosPayphoneInput in
  ) {
    UUID t = tenant(jwt);
    UUID b = in.branchId();
    if (b == null) {
      try {
        b = db.queryForObject("SELECT id FROM branches WHERE tenant_id = ? AND active = true ORDER BY created_at ASC LIMIT 1", UUID.class, t);
      } catch (Exception ignored) {}
    }

    var res = payphoneService.preparePayment(t, b, new PayphonePaymentService.PreparePayphoneRequest(
        in.amount(),
        in.tax(),
        in.quoteId() != null ? "QUOTE" : "POS_SALE",
        in.quoteId(),
        in.saleId(),
        in.customerEmail(),
        in.customerPhone()
    ));

    return ResponseEntity.ok(res);
  }

  @GetMapping("/api/payments/payphone/status/{clientTxId}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> checkStatusInternal(@PathVariable String clientTxId) {
    return ResponseEntity.ok(payphoneService.checkStatus(clientTxId));
  }

  public record SimulateCardInput(String cardBrand, String lastDigits) {}

  @PostMapping("/api/payments/payphone/simulate/{clientTxId}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> simulateSuccessInternal(
      @PathVariable String clientTxId,
      @RequestBody(required = false) SimulateCardInput in
  ) {
    String brand = in != null ? in.cardBrand() : "VISA";
    String digits = in != null ? in.lastDigits() : "4242";
    return ResponseEntity.ok(payphoneService.simulateSuccess(clientTxId, brand, digits));
  }

  // --- 2. PUBLIC CLIENT & WEBHOOK ENDPOINTS ---

  @PostMapping("/api/public/quotes/{token}/payphone/prepare")
  public ResponseEntity<Map<String, Object>> preparePublicQuotePayment(@PathVariable String token) {
    return ResponseEntity.ok(payphoneService.prepareForPublicQuote(token));
  }

  @GetMapping("/api/public/payments/payphone/status/{clientTxId}")
  public ResponseEntity<Map<String, Object>> checkStatusPublic(@PathVariable String clientTxId) {
    return ResponseEntity.ok(payphoneService.checkStatus(clientTxId));
  }

  @PostMapping("/api/public/payments/payphone/simulate/{clientTxId}")
  public ResponseEntity<Map<String, Object>> simulateSuccessPublic(
      @PathVariable String clientTxId,
      @RequestBody(required = false) SimulateCardInput in
  ) {
    String brand = in != null ? in.cardBrand() : "VISA";
    String digits = in != null ? in.lastDigits() : "4242";
    return ResponseEntity.ok(payphoneService.simulateSuccess(clientTxId, brand, digits));
  }

  @PostMapping("/api/public/payments/payphone/callback")
  public ResponseEntity<Map<String, Object>> receiveCallback(@RequestBody Map<String, Object> payload) {
    return ResponseEntity.ok(payphoneService.confirmFromWebhook(payload));
  }
}

