package com.fixme.infrastructure.security;

import com.fixme.application.TokenIssuer;
import com.fixme.domain.AppUser;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenIssuer implements TokenIssuer {
  private final JwtEncoder encoder;
  private final JdbcTemplate db;

  public JwtTokenIssuer(JwtEncoder encoder, JdbcTemplate db) {
    this.encoder = encoder;
    this.db = db;
  }

  @Override
  public String issue(AppUser user) {
    Instant now = Instant.now();
    List<String> permissions = resolvePermissions(user.tenantId(), user.id(), user.role());

    Set<String> scopes = new LinkedHashSet<>();
    scopes.add(user.role());

    if ("SUPER_ADMIN".equals(user.role()) || "TENANT_ADMIN".equals(user.role())) {
      scopes.add("TENANT_ADMIN");
      if ("SUPER_ADMIN".equals(user.role())) {
        scopes.add("SUPER_ADMIN");
      }
    } else if ("MANAGER".equals(user.role())) {
      scopes.addAll(List.of("MANAGER", "SELLER", "TECHNICIAN", "DELIVERY", "ACCOUNTANT"));
    } else {
      if (permissions.contains("pos") || permissions.contains("sales") || permissions.contains("products")) {
        scopes.add("SELLER");
      }
      if (permissions.contains("cash")) {
        scopes.add("SELLER");
        scopes.add("ACCOUNTANT");
      }
      if (permissions.contains("work-orders") || permissions.contains("my-work")) {
        scopes.add("TECHNICIAN");
      }
      if (permissions.contains("deliveries")) {
        scopes.add("DELIVERY");
      }
      if (permissions.contains("reports")) {
        scopes.add("ACCOUNTANT");
      }
      if (permissions.contains("administration")) {
        scopes.add("MANAGER");
      }
    }

    String scopeString = String.join(" ", scopes);

    UUID branchId = null;
    try {
      db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, user.tenantId().toString());
      var ub = db.queryForList("select branch_id from user_branches where user_id = ? limit 1", user.id());
      if (!ub.isEmpty() && ub.get(0).get("branch_id") != null) {
        branchId = (UUID) ub.get(0).get("branch_id");
      } else {
        var b = db.queryForList("select id from branches where tenant_id = ? and active = true order by created_at asc limit 1", user.tenantId());
        if (!b.isEmpty() && b.get(0).get("id") != null) {
          branchId = (UUID) b.get(0).get("id");
        }
      }
    } catch (Exception ignored) {}

    JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
        .issuer("fixmetiendas")
        .subject(user.email())
        .issuedAt(now)
        .expiresAt(now.plus(8, ChronoUnit.HOURS))
        .claim("tenant_id", user.tenantId().toString())
        .claim("user_id", user.id().toString())
        .claim("scope", scopeString)
        .claim("roles", new ArrayList<>(scopes))
        .claim("primary_role", user.role())
        .claim("permissions", permissions);

    if (branchId != null) {
      claimsBuilder.claim("branch_id", branchId.toString());
    }

    JwtClaimsSet claims = claimsBuilder.build();

    return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
  }

  private List<String> resolvePermissions(UUID tenantId, UUID userId, String role) {
    try {
      db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenantId.toString());

      // 1. Check user custom permissions
      var userRows = db.queryForList("SELECT custom_permissions FROM app_users WHERE id = ?", userId);
      if (!userRows.isEmpty() && userRows.get(0).get("custom_permissions") != null) {
        Object cp = userRows.get(0).get("custom_permissions");
        List<String> list = extractArray(cp);
        if (!list.isEmpty()) return list;
      }

      // 2. Check role permissions table
      var roleRows = db.queryForList("SELECT permissions FROM role_permissions WHERE tenant_id = ? AND role = ?", tenantId, role);
      if (!roleRows.isEmpty() && roleRows.get(0).get("permissions") != null) {
        Object rp = roleRows.get(0).get("permissions");
        List<String> list = extractArray(rp);
        if (!list.isEmpty()) return list;
      }
    } catch (Exception ignored) {}

    return defaultPermissions(role);
  }

  private List<String> extractArray(Object obj) {
    try {
      if (obj instanceof String[] arr) {
        return Arrays.asList(arr);
      }
      if (obj instanceof java.sql.Array sqlArr) {
        Object inner = sqlArr.getArray();
        if (inner instanceof String[] arr) {
          return Arrays.asList(arr);
        }
      }
    } catch (Exception ignored) {}
    return Collections.emptyList();
  }

  private List<String> defaultPermissions(String role) {
    return switch (role) {
      case "SUPER_ADMIN", "TENANT_ADMIN" ->
          List.of("platform-overview", "platform-companies", "platform-rates", "platform-payments");
      case "MANAGER" ->
          List.of("home", "cash", "pos", "sales", "administration", "products", "customers", "deliveries", "work-orders", "my-work", "warranties", "reports");
      case "SELLER" ->
          List.of("home", "cash", "pos", "sales", "products", "customers", "work-orders", "warranties");
      case "TECHNICIAN" ->
          List.of("home", "customers", "work-orders", "my-work", "warranties");
      case "DELIVERY" ->
          List.of("home", "customers", "deliveries");
      case "ACCOUNTANT" ->
          List.of("home", "cash", "sales", "reports");
      default ->
          List.of("home");
    };
  }
}
