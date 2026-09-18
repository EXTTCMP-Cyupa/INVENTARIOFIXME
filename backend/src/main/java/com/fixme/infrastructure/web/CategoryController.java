package com.fixme.infrastructure.web;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
  private final JdbcTemplate db;
  public CategoryController(JdbcTemplate db) { this.db = db; }
  private UUID tenant(Jwt jwt) { return UUID.fromString(jwt.getClaimAsString("tenant_id")); }
  private void context(UUID tenant) { db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString()); }
  @GetMapping
  @PreAuthorize("isAuthenticated()")
  public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt); context(tenant);
    return db.queryForList("select id,name,description,active,created_at from categories where tenant_id=? order by name", tenant);
  }
  @PostMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String,Object> create(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String,Object> body) {
    String name = body == null || body.get("name") == null ? "" : body.get("name").toString().trim();
    if (name.isBlank()) throw new IllegalArgumentException("El nombre de la categoría es obligatorio");
    UUID tenant = tenant(jwt); context(tenant); UUID id = UUID.randomUUID();
    db.update("insert into categories(id,tenant_id,name,description) values(?,?,?,?)",
        id, tenant, name, body.get("description"));
    return db.queryForMap("select id,name,description,active,created_at from categories where id=?", id);
  }
}
