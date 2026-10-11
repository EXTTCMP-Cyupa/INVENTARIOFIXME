package com.fixme.infrastructure.web;

import com.fixme.application.ModuleService;
import com.fixme.domain.TenantModule;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/modules")
public class ModuleController {
  private final ModuleService service;

  public ModuleController(ModuleService s) {
    this.service = s;
  }

  @GetMapping
  @PreAuthorize("isAuthenticated()")
  public List<TenantModule> list(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) UUID tenantId) {
    return service.list(target(jwt, tenantId));
  }

  public record Input(boolean enabled) {}

  @PatchMapping("/{key}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public TenantModule set(
      @PathVariable String key,
      @RequestParam(required = false) UUID tenantId,
      @RequestBody Input in,
      @AuthenticationPrincipal Jwt jwt
  ) {
    return service.set(target(jwt, tenantId), key.toUpperCase(Locale.ROOT), in.enabled());
  }

  @PutMapping
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public List<TenantModule> setBulk(
      @RequestParam(required = false) UUID tenantId,
      @RequestBody Map<String, Boolean> modules,
      @AuthenticationPrincipal Jwt jwt
  ) {
    return service.setBulk(target(jwt, tenantId), modules);
  }

  private UUID target(Jwt jwt, UUID requested) {
    UUID own = UUID.fromString(jwt.getClaimAsString("tenant_id"));
    String scope = jwt.getClaimAsString("scope");
    boolean platformAdmin = scope != null && (scope.contains("SUPER_ADMIN") || scope.contains("TENANT_ADMIN"));
    if (requested != null && platformAdmin) return requested;
    return own;
  }
}
