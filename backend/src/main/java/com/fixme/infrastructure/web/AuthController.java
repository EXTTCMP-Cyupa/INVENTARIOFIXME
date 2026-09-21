package com.fixme.infrastructure.web;

import com.fixme.application.AuthenticationException;
import com.fixme.application.AuthenticationService;
import com.fixme.application.PasswordHasher;
import java.math.BigDecimal;
import java.util.*;
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
      String fullName,
      Boolean isTrial,
      Integer trialDaysRemaining,
      String trialEndsAt
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

      boolean isTrial = false;
      Integer trialDaysRemaining = null;
      String trialEndsAt = null;

      var tenantRows = db.queryForList("""
          SELECT subscription_status, is_trial, trial_ends_at,
                 (trial_ends_at - CURRENT_DATE) as days_left
          FROM tenants WHERE id = ?
          """, tenantId);

      if (!tenantRows.isEmpty()) {
        var tRow = tenantRows.get(0);
        String subStatus = String.valueOf(tRow.get("subscription_status"));
        isTrial = Boolean.TRUE.equals(tRow.get("is_trial")) || "TRIAL".equalsIgnoreCase(subStatus);
        if (tRow.get("trial_ends_at") != null) {
          trialEndsAt = String.valueOf(tRow.get("trial_ends_at")).substring(0, 10);
        }
        if (tRow.get("days_left") != null) {
          trialDaysRemaining = ((Number) tRow.get("days_left")).intValue();
        }

        // If not platform owner (TENANT_ADMIN or SUPER_ADMIN), check store subscription / trial status
        if (!"TENANT_ADMIN".equalsIgnoreCase(role) && !"SUPER_ADMIN".equalsIgnoreCase(role)) {
          if ("SUSPENDED".equalsIgnoreCase(subStatus)) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
                "error", "STORE_SUSPENDED",
                "message", "Esta tienda se encuentra suspendida por mensualidad pendiente. Por favor contacta al administrador del sistema."
            ));
          }
          if (isTrial && trialDaysRemaining != null && trialDaysRemaining < 0) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
                "error", "TRIAL_EXPIRED",
                "message", "Tu período de prueba de 15 días ha finalizado. Por favor contacta a la administración para activar tu plan definitivo y continuar usando el sistema."
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
          fullName,
          isTrial,
          trialDaysRemaining,
          trialEndsAt
      ));
    } catch (AuthenticationException exception) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }

  public record RegisterStoreRequest(
      String storeName,
      String companyName,
      String ownerName,
      String managerName,
      String email,
      String password,
      String phone,
      String businessType,
      String plan
  ) {
    public String resolveStoreName() {
      if (storeName != null && !storeName.isBlank()) return storeName.trim();
      if (companyName != null && !companyName.isBlank()) return companyName.trim();
      return null;
    }
    public String resolveOwnerName() {
      if (ownerName != null && !ownerName.isBlank()) return ownerName.trim();
      if (managerName != null && !managerName.isBlank()) return managerName.trim();
      return "Administrador";
    }
  }

  @PostMapping("/register")
  public ResponseEntity<?> registerStore(@RequestBody RegisterStoreRequest req) {
    String storeName = req != null ? req.resolveStoreName() : null;
    if (req == null || req.email() == null || req.email().isBlank()
        || req.password() == null || req.password().length() < 8
        || storeName == null || storeName.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "VALIDATION_FAILED",
          "message", "Nombre de la tienda, correo electrónico y contraseña de al menos 8 caracteres son requeridos."
      ));
    }

    String email = req.email().trim().toLowerCase(Locale.ROOT);
    String rawPassword = req.password();
    String ownerName = req.resolveOwnerName();
    String phone = req.phone() != null ? req.phone().trim() : "";
    String businessType = req.businessType() != null && !req.businessType().isBlank() ? req.businessType().toUpperCase(Locale.ROOT) : "RETAIL";
    String planCode = req.plan() != null && !req.plan().isBlank() ? req.plan().toUpperCase(Locale.ROOT) : "PRO";

    // 1. Check if email is already registered
    int existingUsers = db.queryForObject("SELECT count(*) FROM app_users WHERE lower(email) = lower(?)", Integer.class, email);
    if (existingUsers > 0) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
          "error", "EMAIL_ALREADY_EXISTS",
          "message", "El correo electrónico '" + email + "' ya se encuentra registrado. Por favor inicia sesión."
      ));
    }

    // 2. Fetch plan details and included modules
    BigDecimal monthlyFee = new BigDecimal("49.00");
    List<String> planModules = List.of("INVENTORY", "POS", "CASH_REGISTER", "QUOTES", "CUSTOMERS", "REPORTS");
    try {
      var planRows = db.queryForList("SELECT monthly_price, included_modules FROM subscription_plans WHERE UPPER(code) = UPPER(?)", planCode);
      if (!planRows.isEmpty()) {
        var pRow = planRows.get(0);
        if (pRow.get("monthly_price") != null) {
          monthlyFee = new BigDecimal(pRow.get("monthly_price").toString());
        }
        Object incMods = pRow.get("included_modules");
        if (incMods instanceof java.sql.Array sqlArr) {
          String[] arr = (String[]) sqlArr.getArray();
          planModules = Arrays.asList(arr);
        } else if (incMods instanceof List<?> l) {
          List<String> parsed = new ArrayList<>();
          for (Object o : l) parsed.add(String.valueOf(o));
          planModules = parsed;
        }
      }
    } catch (Exception ignored) {}

    // 3. Provision new tenant & structure (15-Day Free Trial with ALL modules enabled)
    UUID tenantId = UUID.randomUUID();
    UUID branchId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();
    UUID cashRegisterId = UUID.randomUUID();

    db.update("""
        INSERT INTO tenants (id, name, plan, intended_plan, is_trial, trial_ends_at, subscription_status, payment_status, monthly_fee, billing_cycle, discount_percent, next_billing_date, last_payment_date, business_type, phone, created_at)
        VALUES (?, ?, 'TRIAL', ?, true, CURRENT_DATE + interval '15 days', 'TRIAL', 'PENDING', ?, 'MONTHLY', 0.00, CURRENT_DATE + interval '15 days', CURRENT_DATE, ?, ?, now())
        """,
        tenantId, storeName, planCode, monthlyFee, businessType, phone
    );

    // Set tenant context for RLS
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());

    db.update("INSERT INTO branches (id, tenant_id, name, created_at) VALUES (?, ?, 'Principal', now())", branchId, tenantId);

    db.update("""
        INSERT INTO app_users (id, tenant_id, email, password_hash, role, full_name, phone)
        VALUES (?, ?, ?, ?, 'MANAGER', ?, ?)
        """,
        userId, tenantId, email, passwords.hash(rawPassword), ownerName, phone
    );

    db.update("INSERT INTO user_branches (user_id, branch_id, tenant_id) VALUES (?, ?, ?)", userId, branchId, tenantId);
    db.update("INSERT INTO cash_registers (id, tenant_id, branch_id, name) VALUES (?, ?, ?, 'Caja Principal')", cashRegisterId, tenantId, branchId);

    // Seed default role permissions
    db.update("""
        INSERT INTO role_permissions(id, tenant_id, role, permissions, updated_at) VALUES
        (uuid_generate_v4(), ?, 'MANAGER', ARRAY['home','cash','pos','sales','quotes','administration','products','customers','deliveries','work-orders','my-work','warranties','reports'], now()),
        (uuid_generate_v4(), ?, 'TECHNICIAN', ARRAY['home','my-work','work-orders','warranties','customers'], now()),
        (uuid_generate_v4(), ?, 'SELLER', ARRAY['home','cash','pos','sales','quotes','products','customers','work-orders','warranties'], now()),
        (uuid_generate_v4(), ?, 'DELIVERY', ARRAY['home','customers','deliveries'], now()),
        (uuid_generate_v4(), ?, 'ACCOUNTANT', ARRAY['home','cash','sales','quotes','reports'], now())
        ON CONFLICT(tenant_id, role) DO NOTHING
        """, tenantId, tenantId, tenantId, tenantId, tenantId);

    // Enable ALL 9 modules for the trial store so the merchant can test every single feature!
    List<String> allModules = List.of(
        "INVENTORY", "POS", "CASH_REGISTER", "QUOTES", "WORK_ORDERS", "DELIVERIES", "CUSTOMERS", "REPORTS", "APIS"
    );
    for (String mod : allModules) {
      db.update("""
          INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_at)
          VALUES (?, ?, true, now())
          ON CONFLICT (tenant_id, module_key) DO UPDATE
          SET enabled = true, updated_at = now()
          """, tenantId, mod);
    }

    // 4. Authenticate & issue JWT
    try {
      String token = authentication.login(tenantId, email, rawPassword);
      String trialEndDateStr = java.time.LocalDate.now().plusDays(15).toString();
      return ResponseEntity.ok(new LoginResponse(
          token,
          "Bearer",
          8 * 60 * 60,
          tenantId,
          branchId,
          storeName,
          "MANAGER",
          ownerName,
          true,
          15,
          trialEndDateStr
      ));
    } catch (Exception e) {
      return ResponseEntity.ok(Map.of(
          "success", true,
          "message", "Tienda creada exitosamente en modo prueba (15 días). Por favor inicia sesión.",
          "email", email
      ));
    }
  }
}
