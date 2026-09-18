package com.fixme.infrastructure.web;

import com.fixme.application.AuthenticationException;
import com.fixme.application.AuthenticationService;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthenticationService authentication;
  private final JdbcTemplate db;

  public AuthController(AuthenticationService authentication, JdbcTemplate db) {
    this.authentication = authentication;
    this.db = db;
  }

  public record LoginRequest(UUID tenantId, String email, String password) {}
  public record LoginResponse(String accessToken, String tokenType, long expiresIn) {}

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    try {
      if (request == null || request.tenantId() == null || request.email() == null || request.password() == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      UUID tenantId = request.tenantId();
      String email = request.email().trim().toLowerCase(Locale.ROOT);

      // Check user role first
      var users = db.queryForList("select role from app_users where tenant_id = ? and lower(email) = lower(?)", tenantId, email);
      if (!users.isEmpty()) {
        String role = String.valueOf(users.get(0).get("role"));
        // If not platform owner (TENANT_ADMIN or SUPER_ADMIN), check store subscription status
        if (!"TENANT_ADMIN".equalsIgnoreCase(role) && !"SUPER_ADMIN".equalsIgnoreCase(role)) {
          var tenantRows = db.queryForList("select subscription_status from tenants where id = ?", tenantId);
          if (!tenantRows.isEmpty()) {
            String subStatus = String.valueOf(tenantRows.get(0).get("subscription_status"));
            if ("SUSPENDED".equalsIgnoreCase(subStatus)) {
              return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
                  "error", "STORE_SUSPENDED",
                  "message", "Esta tienda se encuentra suspendida por mensualidad pendiente. Por favor contacta al administrador del sistema."
              ));
            }
          }
        }
      }

      String token = authentication.login(request.tenantId(), request.email(), request.password());
      return ResponseEntity.ok(new LoginResponse(token, "Bearer", 8 * 60 * 60));
    } catch (AuthenticationException exception) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }
}
