package com.fixme.infrastructure.web;

import com.fixme.application.QuoteService;
import com.fixme.domain.Quote;
import com.fixme.domain.Sale;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class QuoteController {
  private final QuoteService quoteService;
  private final JdbcTemplate db;

  public QuoteController(QuoteService quoteService, JdbcTemplate db) {
    this.quoteService = quoteService;
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  private UUID user(UUID t, String email) {
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, t.toString());
    return db.queryForObject("SELECT id FROM app_users WHERE tenant_id = ? AND lower(email) = lower(?)", UUID.class, t, email);
  }

  // --- INTERNAL AUTHENTICATED APIS ---

  @GetMapping("/api/quotes")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search
  ) {
    UUID t = tenant(jwt);
    return quoteService.listQuotes(t, branchId, status, search);
  }

  @PostMapping("/api/quotes")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public Quote create(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId,
      @RequestBody QuoteService.CreateQuoteCommand cmd
  ) {
    UUID t = tenant(jwt);
    UUID u = user(t, jwt.getSubject());
    if (branchId == null) {
      try {
        branchId = db.queryForObject("SELECT id FROM branches WHERE tenant_id = ? AND active = true ORDER BY created_at ASC LIMIT 1", UUID.class, t);
      } catch (Exception ignored) {}
    }
    return quoteService.createQuote(t, branchId, u, cmd);
  }

  @GetMapping("/api/quotes/{id}")
  @PreAuthorize("isAuthenticated()")
  public Quote getById(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id
  ) {
    UUID t = tenant(jwt);
    return quoteService.findById(t, id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cotización no encontrada"));
  }

  @PutMapping("/api/quotes/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public Quote update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody QuoteService.CreateQuoteCommand cmd
  ) {
    UUID t = tenant(jwt);
    return quoteService.updateQuote(t, id, cmd);
  }

  @PatchMapping("/api/quotes/{id}/status")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public Quote updateStatus(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody Map<String, String> body
  ) {
    UUID t = tenant(jwt);
    String status = body.get("status");
    if (status == null || status.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado requerido");
    }
    return quoteService.updateStatus(t, id, status);
  }

  @PostMapping("/api/quotes/{id}/convert-to-sale")
  @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public Sale convertToSale(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId,
      @PathVariable UUID id,
      @RequestBody QuoteService.ConvertToSaleCommand cmd
  ) {
    UUID t = tenant(jwt);
    UUID u = user(t, jwt.getSubject());
    if (branchId == null) {
      try {
        branchId = db.queryForObject("SELECT id FROM branches WHERE tenant_id = ? AND active = true ORDER BY created_at ASC LIMIT 1", UUID.class, t);
      } catch (Exception ignored) {}
    }
    return quoteService.convertToSale(t, branchId, u, id, cmd);
  }

  // --- PUBLIC CLIENT APIS ---

  @GetMapping("/api/public/quotes/{token}")
  public ResponseEntity<Map<String, Object>> getPublicQuote(@PathVariable String token) {
    Quote q = quoteService.findByPublicToken(token)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cotización no encontrada o enlace expirado"));

    List<Map<String, Object>> storeList = db.queryForList("""
        SELECT t.name AS store_name, b.name AS branch_name, COALESCE(t.address, '') AS branch_address, COALESCE(t.phone, '') AS branch_phone
        FROM tenants t
        LEFT JOIN branches b ON b.id = ?
        WHERE t.id = ?
        """, q.getBranchId(), q.getTenantId());

    Map<String, Object> storeInfo = storeList.isEmpty() ? Map.of("store_name", "FixmeTiendas") : storeList.get(0);

    Map<String, Object> res = new LinkedHashMap<>();
    res.put("id", q.getId());
    res.put("quoteNumber", q.getQuoteNumber());
    res.put("customerName", q.getCustomerName());
    res.put("customerPhone", q.getCustomerPhone());
    res.put("customerEmail", q.getCustomerEmail());
    res.put("customerIdentification", q.getCustomerIdNumber());
    res.put("subtotal", q.getSubtotal());
    res.put("discount", q.getDiscount());
    res.put("tax", q.getTax());
    res.put("total", q.getTotal());
    res.put("status", q.getStatus());
    res.put("validUntil", q.getValidUntil());
    res.put("notes", q.getNotes());
    res.put("terms", q.getTerms());
    res.put("publicToken", q.getPublicToken());
    res.put("createdAt", q.getCreatedAt());
    res.put("store", storeInfo);

    List<Map<String, Object>> items = q.getItems().stream().map(it -> Map.<String, Object>of(
        "id", it.getId(),
        "itemType", it.getItemType(),
        "description", it.getDescription(),
        "quantity", it.getQuantity(),
        "unitPrice", it.getUnitPrice(),
        "discount", it.getDiscount(),
        "lineTotal", it.getLineTotal()
    )).toList();
    res.put("items", items);

    return ResponseEntity.ok(res);
  }

  @PostMapping("/api/public/quotes/{token}/approve")
  public ResponseEntity<Map<String, Object>> publicApproveQuote(@PathVariable String token) {
    Quote q = quoteService.findByPublicToken(token)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cotización no encontrada"));
    quoteService.updateStatus(q.getTenantId(), q.getId(), "APPROVED");
    return ResponseEntity.ok(Map.of("success", true, "message", "Cotización aprobada con éxito. La tienda se pondrá en contacto para coordinar el pago y la entrega."));
  }
}

