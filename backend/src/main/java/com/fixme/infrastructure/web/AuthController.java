package com.fixme.infrastructure.web;

import com.fixme.application.AuthenticationException;
import com.fixme.application.AuthenticationService;
import com.fixme.application.PasswordHasher;
import java.util.List;
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
  private final PasswordHasher passwords;

  public AuthController(AuthenticationService authentication, JdbcTemplate db, PasswordHasher passwords) {
    this.authentication = authentication;
    this.db = db;
    this.passwords = passwords;
  }

  public record LoginRequest(UUID tenantId, String email, String password) {}
  public record LoginResponse(
      String accessToken,
      String tokenType,
      long expiresIn,
      UUID tenantId,
      UUID branchId,
      String tenantName,
      String role,
      String fullName
  ) {}

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    try {
      if (request == null || request.email() == null || request.email().isBlank() || request.password() == null || request.password().isBlank()) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      String email = request.email().trim().toLowerCase(Locale.ROOT);
      String rawPassword = request.password();
      UUID reqTenantId = request.tenantId();

      List<Map<String, Object>> candidates = List.of();
      if (reqTenantId != null) {
        candidates = db.queryForList(
            "select id, tenant_id, email, password_hash, role, full_name from app_users where tenant_id = ? and lower(email) = lower(?)",
            reqTenantId, email
        );
      }

      // If not found in requested tenant (or no tenant specified, or fallback demo tenant sent)
      if (candidates.isEmpty()) {
        candidates = db.queryForList(
            "select id, tenant_id, email, password_hash, role, full_name from app_users where lower(email) = lower(?)",
            email
        );
      }

      if (candidates.isEmpty()) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      // Find user matching password
      Map<String, Object> matchedUser = null;
      for (var cand : candidates) {
        String hash = String.valueOf(cand.get("password_hash"));
        if (passwords.matches(rawPassword, hash)) {
          matchedUser = cand;
          break;
        }
      }

      if (matchedUser == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      UUID tenantId = (UUID) matchedUser.get("tenant_id");
      UUID userId = (UUID) matchedUser.get("id");
      String role = String.valueOf(matchedUser.get("role"));
      String fullName = matchedUser.get("full_name") != null ? String.valueOf(matchedUser.get("full_name")) : "";

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

      // Resolve branch ID
      UUID branchId = null;
      var userBranchRows = db.queryForList(
          "select branch_id from user_branches where user_id = ? and tenant_id = ? limit 1",
          userId, tenantId
      );
      if (!userBranchRows.isEmpty() && userBranchRows.get(0).get("branch_id") != null) {
        branchId = (UUID) userBranchRows.get(0).get("branch_id");
      } else {
        var branchRows = db.queryForList(
            "select id from branches where tenant_id = ? and active = true order by created_at asc limit 1",
            tenantId
        );
        if (!branchRows.isEmpty() && branchRows.get(0).get("id") != null) {
          branchId = (UUID) branchRows.get(0).get("id");
        }
      }

      // Resolve store name
      String tenantName = "Fixme Tienda";
      var tRows = db.queryForList("select name from tenants where id = ?", tenantId);
      if (!tRows.isEmpty() && tRows.get(0).get("name") != null) {
        tenantName = String.valueOf(tRows.get(0).get("name"));
      }

      String token = authentication.login(tenantId, email, rawPassword);
      return ResponseEntity.ok(new LoginResponse(
          token,
          "Bearer",
          8 * 60 * 60,
          tenantId,
          branchId,
          tenantName,
          role,
          fullName
      ));
    } catch (AuthenticationException exception) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }
}
