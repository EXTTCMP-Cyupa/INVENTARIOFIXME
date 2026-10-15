package com.fixme.infrastructure.web;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {
  private final JdbcTemplate db;

  public ActivityLogController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt j) {
    return UUID.fromString(j.getClaimAsString("tenant_id"));
  }

  @GetMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_SUPER_ADMIN','SCOPE_TENANT_ADMIN','SCOPE_MANAGER')")
  public List<Map<String, Object>> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) UUID branchId,
      @RequestParam(required = false) String action,
      @RequestParam(defaultValue = "50") int limit
  ) {
    UUID t = tenant(jwt);
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());

    StringBuilder sql = new StringBuilder("""
        SELECT l.id, l.branch_id, l.user_id, l.user_email, l.user_role,
               l.action, l.entity_type, l.entity_id, l.details, l.created_at,
               b.name AS branch_name,
               COALESCE(u.full_name, l.user_email) AS user_name
        FROM activity_logs l
        LEFT JOIN branches b ON b.id = l.branch_id
        LEFT JOIN app_users u ON u.id = l.user_id
        WHERE l.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (branchId != null) {
      sql.append(" AND l.branch_id = ?");
      params.add(branchId);
    }
    if (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action)) {
      sql.append(" AND l.action = ?");
      params.add(action.toUpperCase(Locale.ROOT));
    }

    sql.append(" ORDER BY l.created_at DESC LIMIT ?");
    params.add(Math.min(limit, 200));

    return db.queryForList(sql.toString(), params.toArray());
  }
}

