package com.fixme.infrastructure.web;

import com.fixme.application.SubscriptionPlanService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
public class SubscriptionPlanController {

  private final SubscriptionPlanService planService;

  public SubscriptionPlanController(SubscriptionPlanService planService) {
    this.planService = planService;
  }

  // --- 1. PUBLIC LANDING PAGE ENDPOINT ---

  @GetMapping("/api/public/plans")
  public ResponseEntity<List<Map<String, Object>>> getPublicPlans() {
    return ResponseEntity.ok(planService.getActivePlans());
  }

  // --- 2. SAAS OWNER / PLATFORM ADMINISTRATION ENDPOINTS ---

  @GetMapping("/api/platform/plans")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<List<Map<String, Object>>> getAllPlans() {
    return ResponseEntity.ok(planService.getAllPlans());
  }

  @GetMapping("/api/platform/plans/{code}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> getPlan(@PathVariable String code) {
    return ResponseEntity.ok(planService.getPlan(code));
  }

  @PostMapping("/api/platform/plans")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> createPlan(@RequestBody Map<String, Object> body) {
    return ResponseEntity.ok(planService.createPlan(body));
  }

  @PutMapping("/api/platform/plans/{code}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> updatePlan(
      @PathVariable String code,
      @RequestBody Map<String, Object> body
  ) {
    return ResponseEntity.ok(planService.updatePlan(code, body));
  }

  @DeleteMapping("/api/platform/plans/{code}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> deletePlan(@PathVariable String code) {
    planService.deletePlan(code);
    return ResponseEntity.ok(Map.of("success", true, "code", code));
  }

  @GetMapping("/api/platform/tenants/{tenantId}/modules")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> getTenantModules(@PathVariable UUID tenantId) {
    return ResponseEntity.ok(planService.getTenantModules(tenantId));
  }

  @PutMapping("/api/platform/tenants/{tenantId}/modules")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> updateTenantModules(
      @PathVariable UUID tenantId,
      @RequestBody Map<String, Boolean> modules
  ) {
    return ResponseEntity.ok(planService.updateTenantModules(tenantId, modules));
  }

  @PostMapping("/api/platform/tenants/{tenantId}/apply-plan/{planCode}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> applyPlanToTenant(
      @PathVariable UUID tenantId,
      @PathVariable String planCode
  ) {
    return ResponseEntity.ok(planService.applyPlanToTenant(tenantId, planCode));
  }

  // --- 3. TRIAL STORES & CONVERSION MANAGEMENT ---

  @GetMapping("/api/platform/trials")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<List<Map<String, Object>>> getTrialTenants() {
    return ResponseEntity.ok(planService.getTrialTenants());
  }

  @PostMapping("/api/platform/tenants/{tenantId}/extend-trial")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> extendTrial(
      @PathVariable UUID tenantId,
      @RequestBody(required = false) Map<String, Object> body
  ) {
    int days = 15;
    String notes = "";
    if (body != null) {
      if (body.get("days") != null) {
        days = ((Number) body.get("days")).intValue();
      }
      if (body.get("notes") != null) {
        notes = String.valueOf(body.get("notes"));
      }
    }
    return ResponseEntity.ok(planService.extendTrial(tenantId, days, notes));
  }

  @PostMapping("/api/platform/tenants/{tenantId}/convert-trial")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> convertTrial(
      @PathVariable UUID tenantId,
      @RequestBody(required = false) Map<String, Object> body
  ) {
    return ResponseEntity.ok(planService.convertTrial(tenantId, body != null ? body : Map.of()));
  }

  @GetMapping("/api/tenant/trial-status")
  public ResponseEntity<Map<String, Object>> getMyTrialStatus(@AuthenticationPrincipal Jwt jwt) {
    if (jwt == null || jwt.getClaimAsString("tenant_id") == null) {
      return ResponseEntity.badRequest().build();
    }
    UUID tenantId = UUID.fromString(jwt.getClaimAsString("tenant_id"));
    return ResponseEntity.ok(planService.getTenantTrialInfo(tenantId));
  }
}

