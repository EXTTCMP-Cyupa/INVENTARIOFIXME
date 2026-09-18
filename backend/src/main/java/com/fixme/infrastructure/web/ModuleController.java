package com.fixme.infrastructure.web;
import com.fixme.application.ModuleService; import com.fixme.domain.TenantModule; import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.oauth2.jwt.Jwt; import org.springframework.security.core.annotation.AuthenticationPrincipal; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/modules") public class ModuleController {
 private final ModuleService service; public ModuleController(ModuleService s){service=s;}
 @GetMapping @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
 public List<TenantModule> list(@AuthenticationPrincipal Jwt jwt,@RequestParam(required=false) UUID tenantId){return service.list(target(jwt,tenantId));}
 public record Input(boolean enabled){}
 @PatchMapping("/{key}") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
 public TenantModule set(@PathVariable String key,@RequestParam(required=false) UUID tenantId,@RequestBody Input in,@AuthenticationPrincipal Jwt jwt){return service.set(target(jwt,tenantId),key.toUpperCase(Locale.ROOT),in.enabled());}
 private UUID target(Jwt jwt,UUID requested){UUID own=UUID.fromString(jwt.getClaimAsString("tenant_id"));String scope=jwt.getClaimAsString("scope");boolean superAdmin=scope!=null&&scope.contains("SUPER_ADMIN");if(requested!=null&&superAdmin)return requested;return own;}
}
