package com.fixme.infrastructure.web;

import com.fixme.application.PasswordHasher;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/administration")
public class AdministrationController {
  private final JdbcTemplate db;
  private final PasswordHasher passwords;

  public AdministrationController(JdbcTemplate d, PasswordHasher p) {
    this.db = d;
    this.passwords = p;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  private void ctx(UUID t) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
  }

  @GetMapping("/profile")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> profile(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    return db.queryForMap(
        "select id,name,business_type,legal_name,tax_id,address,phone,logo_url,plan,subscription_status,limits from tenants where id=?",
        t);
  }

  @PatchMapping("/profile")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> update(@AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> x) {
    UUID t = tenant(j);
    ctx(t);
    db.update(
        "update tenants set name=coalesce(?,name),business_type=coalesce(?,business_type),legal_name=coalesce(?,legal_name),tax_id=coalesce(?,tax_id),address=coalesce(?,address),phone=coalesce(?,phone),logo_url=coalesce(?,logo_url),plan=coalesce(?,plan) where id=?",
        x.get("name"), x.get("businessType"), x.get("legalName"), x.get("taxId"), x.get("address"), x.get("phone"),
        x.get("logoUrl"), x.get("plan"), t);
    return profile(j);
  }

  @GetMapping("/users")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public List<Map<String, Object>> users(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    var raw = db.queryForList(
        "select id,email,role,full_name,identification,address,phone,custom_permissions from app_users where tenant_id=? order by full_name,email",
        t);
    List<Map<String, Object>> result = new ArrayList<>();
    for (var r : raw) {
      Map<String, Object> item = new HashMap<>(r);
      item.put("custom_permissions", extractArray(r.get("custom_permissions")));
      result.add(item);
    }
    return result;
  }

  public record UserInput(String email, String password, String role, UUID branchId, String fullName,
      String identification, String address, String phone, List<String> customPermissions) {}

  @PostMapping("/users")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> createUser(@AuthenticationPrincipal Jwt j, @RequestBody UserInput in) {
    if (in == null || in.email() == null || in.password() == null || in.password().length() < 8 || in.role() == null)
      throw new IllegalArgumentException("email, password y role son obligatorios");
    String role = in.role().toUpperCase(Locale.ROOT);
    String primaryRole = j.getClaimAsString("primary_role");
    String scope = j.getClaimAsString("scope");
    String creator = primaryRole != null ? primaryRole : (scope != null ? scope : "");
    boolean allowed = creator.contains("SUPER_ADMIN") || (creator.contains("TENANT_ADMIN")
        && Set.of("MANAGER", "SELLER", "DELIVERY", "TECHNICIAN", "ACCOUNTANT").contains(role))
        || (creator.contains("MANAGER") && Set.of("SELLER", "DELIVERY", "TECHNICIAN", "ACCOUNTANT").contains(role));
    if (!allowed)
      throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,
          "No puede asignar este rol");
    UUID t = tenant(j);
    ctx(t);
    UUID id = UUID.randomUUID();
    String[] perms = in.customPermissions() != null ? in.customPermissions().toArray(new String[0]) : null;

    db.update(
        "insert into app_users(id,tenant_id,email,password_hash,role,full_name,identification,address,phone,custom_permissions) values(?,?,?,?,?,?,?,?,?,?)",
        id, t, in.email().trim().toLowerCase(), passwords.hash(in.password()), role, in.fullName(), in.identification(),
        in.address(), in.phone(), perms);
    if (in.branchId() != null && db.update(
        "insert into user_branches(user_id,branch_id,tenant_id) select ?,id,? from branches where id=? and tenant_id=? on conflict do nothing",
        id, t, in.branchId(), t) != 1)
      throw new IllegalArgumentException("La sucursal no pertenece a la empresa");
    return db.queryForMap("select id,email,role,full_name,identification,address,phone from app_users where id=?", id);
  }

  @PutMapping("/users/{userId}/branches/{branchId}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public void assign(@AuthenticationPrincipal Jwt j, @PathVariable UUID userId, @PathVariable UUID branchId) {
    UUID t = tenant(j);
    ctx(t);
    if (db.update(
        "insert into user_branches(user_id,branch_id,tenant_id) select u.id,b.id,? from app_users u,branches b where u.id=? and b.id=? and u.tenant_id=? and b.tenant_id=? on conflict do nothing",
        t, userId, branchId, t, t) != 1)
      throw new IllegalArgumentException("Usuario o sucursal no pertenecen a la empresa");
  }

  @GetMapping("/branches")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> branches(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    return db.queryForList("select id,name,active from branches where tenant_id=? order by name", t);
  }

  // --- ROLE PERMISSIONS MATRIX ---

  @GetMapping("/role-permissions")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> getRolePermissions(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    var rows = db.queryForList("select role, permissions from role_permissions where tenant_id=?", t);
    Map<String, Object> out = new HashMap<>();
    for (var r : rows) {
      String role = (String) r.get("role");
      out.put(role, extractArray(r.get("permissions")));
    }
    // Ensure all standard roles have an entry
    for (String r : List.of("MANAGER", "SELLER", "TECHNICIAN", "DELIVERY", "ACCOUNTANT")) {
      if (!out.containsKey(r)) {
        out.put(r, defaultPermissions(r));
      }
    }
    return out;
  }

  public record RolePermissionInput(String role, List<String> permissions) {}

  @PutMapping("/role-permissions")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateRolePermissions(@AuthenticationPrincipal Jwt j, @RequestBody RolePermissionInput in) {
    UUID t = tenant(j);
    ctx(t);
    String role = in.role().toUpperCase(Locale.ROOT);
    List<String> perms = in.permissions() != null ? in.permissions() : Collections.emptyList();
    String[] arr = perms.toArray(new String[0]);

    db.update("""
        insert into role_permissions(id, tenant_id, role, permissions, updated_at)
        values(uuid_generate_v4(), ?, ?, ?, now())
        on conflict(tenant_id, role) do update set permissions = excluded.permissions, updated_at = now()
        """, t, role, arr);

    return getRolePermissions(j);
  }

  public record UserPermissionInput(List<String> permissions) {}

  @PutMapping("/users/{userId}/permissions")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateUserPermissions(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID userId,
      @RequestBody UserPermissionInput in
  ) {
    UUID t = tenant(j);
    ctx(t);
    String[] arr = in.permissions() != null ? in.permissions().toArray(new String[0]) : null;
    db.update("update app_users set custom_permissions = ? where tenant_id = ? and id = ?", arr, t, userId);
    return Map.of("userId", userId, "customPermissions", in.permissions() != null ? in.permissions() : Collections.emptyList());
  }

  @GetMapping("/my-permissions")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> myPermissions(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    String email = j.getSubject();
    var userRow = db.queryForMap("select id, role, custom_permissions from app_users where tenant_id=? and lower(email)=lower(?)", t, email);
    UUID uId = (UUID) userRow.get("id");
    String role = (String) userRow.get("role");

    List<String> permissions = new ArrayList<>(extractArray(userRow.get("custom_permissions")));
    if (permissions.isEmpty()) {
      var roleRows = db.queryForList("select permissions from role_permissions where tenant_id=? and role=?", t, role);
      if (!roleRows.isEmpty()) {
        permissions.addAll(extractArray(roleRows.get(0).get("permissions")));
      }
    }

    if (permissions.isEmpty()) {
      permissions.addAll(defaultPermissions(role));
    }

    return Map.of("role", role, "permissions", permissions, "userId", uId);
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
      case "SUPER_ADMIN", "TENANT_ADMIN", "MANAGER" ->
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
