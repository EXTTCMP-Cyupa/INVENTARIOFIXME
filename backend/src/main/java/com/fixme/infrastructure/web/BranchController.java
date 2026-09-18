package com.fixme.infrastructure.web;
import com.fixme.application.BranchService;
import com.fixme.domain.Branch;
import java.util.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/branches")
public class BranchController {
  private final BranchService service;
  public BranchController(BranchService service){this.service=service;}
  public record Input(String name){}
  @GetMapping @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public List<Branch> list(@AuthenticationPrincipal Jwt jwt){return service.list(tenant(jwt));}
  @PostMapping @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Branch create(@AuthenticationPrincipal Jwt jwt,@RequestBody Input i){return service.create(new Branch(null,tenant(jwt),i.name()));}
  private UUID tenant(Jwt jwt){try{return UUID.fromString(jwt.getClaimAsString("tenant_id"));}catch(Exception e){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Tenant inválido");}}
}
