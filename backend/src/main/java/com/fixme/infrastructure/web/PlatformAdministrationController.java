package com.fixme.infrastructure.web;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.fixme.application.PasswordHasher;

@RestController
@RequestMapping("/api/platform")
@PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
public class PlatformAdministrationController {
  private final JdbcTemplate db;
  private final PasswordHasher passwords;
  public PlatformAdministrationController(JdbcTemplate db, PasswordHasher passwords) { this.db = db; this.passwords = passwords; }

  @GetMapping("/tenants")
  public List<Map<String,Object>> tenants(@RequestParam(required=false) String q) {
    if (q == null || q.isBlank())
      return db.queryForList("select id,name,business_type,plan,subscription_status,limits,created_at from tenants order by name");
    return db.queryForList("select id,name,business_type,plan,subscription_status,limits,created_at from tenants where name ilike ? order by name", "%" + q + "%");
  }

  @PostMapping("/tenants")
  public Map<String,Object> create(@RequestBody Map<String,Object> input, @AuthenticationPrincipal Jwt jwt) {
    UUID id = UUID.randomUUID();
    db.update("insert into tenants(id,name,plan,subscription_status) values(?,?,coalesce(?,'STARTER'),coalesce(?,'ACTIVE'))",
        id, required(input,"name"), input.get("plan"), input.get("subscriptionStatus"));
    ctx(id);
    String ownerEmail = String.valueOf(input.getOrDefault("ownerEmail", "")).trim().toLowerCase(Locale.ROOT);
    String ownerPassword = String.valueOf(input.getOrDefault("ownerPassword", ""));
    if (ownerEmail.isBlank() || ownerPassword.length() < 8)
      throw new IllegalArgumentException("ownerEmail y ownerPassword de mínimo 8 caracteres son obligatorios");
    UUID branch = UUID.randomUUID(), owner = UUID.randomUUID();
    db.update("insert into branches(id,tenant_id,name) values(?,?,?)", branch, id, "Principal");
    db.update("insert into app_users(id,tenant_id,email,password_hash,role,full_name) values(?,?,?,?,?,?)",
        owner, id, ownerEmail, passwords.hash(ownerPassword), "MANAGER", input.get("ownerName"));
    audit(jwt, id, "TENANT_CREATED", input);
    return db.queryForMap("select id,name,business_type,plan,subscription_status,limits from tenants where id=?", id);
  }

  @PatchMapping("/tenants/{tenantId}")
  public Map<String,Object> update(@PathVariable UUID tenantId, @RequestBody Map<String,Object> input,
      @AuthenticationPrincipal Jwt jwt) {
    if (input.containsKey("plan"))
      db.update("update tenants set plan=? where id=?", input.get("plan"), tenantId);
    if (input.containsKey("subscriptionStatus"))
      db.update("update tenants set subscription_status=? where id=?", input.get("subscriptionStatus"), tenantId);
    audit(jwt, tenantId, "TENANT_PLAN_UPDATED", input);
    return db.queryForMap("select id,name,business_type,plan,subscription_status,limits from tenants where id=?", tenantId);
  }

  @GetMapping("/tenants/{tenantId}/users")
  public List<Map<String,Object>> users(@PathVariable UUID tenantId) {
    ctx(tenantId);
    return db.queryForList("select id,email,role,full_name,identification,address,phone from app_users where tenant_id=? order by full_name,email", tenantId);
  }

  @GetMapping("/tenants/{tenantId}/inventory")
  public Map<String,Object> inventory(@PathVariable UUID tenantId) {
    ctx(tenantId);
    Map<String,Object> result = new LinkedHashMap<>();
    result.put("tenantId", tenantId);
    result.put("products", db.queryForObject("select count(*) from products where tenant_id=?", Integer.class, tenantId));
    result.put("units", db.queryForObject("select coalesce(sum(stock),0) from product_stock where product_id in (select id from products where tenant_id=?)", Integer.class, tenantId));
    result.put("value", db.queryForObject("select coalesce(sum(ps.stock*p.price),0) from product_stock ps join products p on p.id=ps.product_id where p.tenant_id=?", java.math.BigDecimal.class, tenantId));
    result.put("items", db.queryForList("select p.id,p.sku,p.name,p.price,coalesce(sum(ps.stock),0) stock from products p left join product_stock ps on ps.product_id=p.id where p.tenant_id=? group by p.id order by p.name", tenantId));
    return result;
  }

  @GetMapping("/tenants/{tenantId}/overview")
  public Map<String,Object> overview(@PathVariable UUID tenantId) {
    ctx(tenantId);
    Map<String,Object> result = new LinkedHashMap<>();
    result.put("users", db.queryForObject("select count(*) from app_users where tenant_id=?", Integer.class, tenantId));
    result.put("products", db.queryForObject("select count(*) from products where tenant_id=?", Integer.class, tenantId));
    result.put("customers", db.queryForObject("select count(*) from customers where tenant_id=?", Integer.class, tenantId));
    result.put("orders", db.queryForObject("select count(*) from work_orders where tenant_id=?", Integer.class, tenantId));
    return result;
  }

  @PatchMapping("/tenants/{tenantId}/users/{userId}/role")
  public void role(@PathVariable UUID tenantId, @PathVariable UUID userId,
      @RequestBody Map<String,Object> input, @AuthenticationPrincipal Jwt jwt) {
    String role = String.valueOf(input.getOrDefault("role", "")).toUpperCase(Locale.ROOT);
    if (!Set.of("SUPER_ADMIN","TENANT_ADMIN","MANAGER","SELLER","DELIVERY","TECHNICIAN","ACCOUNTANT").contains(role))
      throw new IllegalArgumentException("Rol inválido");
    ctx(tenantId);
    if (db.update("update app_users set role=? where id=? and tenant_id=?", role, userId, tenantId) != 1)
      throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Usuario no encontrado");
    audit(jwt, tenantId, "USER_ROLE_UPDATED", Map.of("userId", userId, "role", role));
  }

  @PatchMapping("/tenants/{tenantId}/modules/{key}")
  public void module(@PathVariable UUID tenantId, @PathVariable String key, @RequestBody Map<String,Object> input,
      @AuthenticationPrincipal Jwt jwt) {
    ctx(tenantId);
    db.update("insert into tenant_modules(tenant_id,module_key,enabled) values(?,?,?) on conflict(tenant_id,module_key) do update set enabled=excluded.enabled,updated_at=now()",
        tenantId, key.toUpperCase(Locale.ROOT), Boolean.TRUE.equals(input.get("enabled")));
    audit(jwt, tenantId, "MODULE_UPDATED", Map.of("module", key, "enabled", input.get("enabled")));
  }

  private void ctx(UUID tenant) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
  }

  private void audit(Jwt jwt, UUID tenant, String action, Object detail) {
    db.update("insert into audit_log(tenant_id,actor_email,action,details) values(?,?,?,to_jsonb(?::text))",
        tenant, jwt.getSubject(), action, String.valueOf(detail).replace('=', ':'));
  }
  private Object required(Map<String,Object> m, String key) {
    Object v = m.get(key); if (v == null || String.valueOf(v).isBlank()) throw new IllegalArgumentException(key+" es obligatorio"); return v;
  }
}
