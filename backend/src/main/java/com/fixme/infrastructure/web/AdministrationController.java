package com.fixme.infrastructure.web;
import java.util.*; import org.springframework.jdbc.core.JdbcTemplate; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.oauth2.jwt.Jwt; import org.springframework.security.core.annotation.AuthenticationPrincipal; import org.springframework.web.bind.annotation.*; import com.fixme.application.PasswordHasher;
@RestController @RequestMapping("/api/administration") public class AdministrationController {
 private final JdbcTemplate db; private final PasswordHasher passwords; public AdministrationController(JdbcTemplate d, PasswordHasher p){db=d;passwords=p;}
 private UUID tenant(Jwt j){return UUID.fromString(j.getClaimAsString("tenant_id"));} private void ctx(UUID t){db.queryForObject("select set_config('app.tenant_id',?,true)",String.class,t.toString());}
 @GetMapping("/profile") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')") Map<String,Object> profile(@AuthenticationPrincipal Jwt j){UUID t=tenant(j);ctx(t);return db.queryForMap("select id,name,business_type,legal_name,tax_id,address,phone,logo_url,plan,subscription_status,limits from tenants where id=?",t);}
 @PatchMapping("/profile") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") Map<String,Object> update(@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object> x){UUID t=tenant(j);ctx(t);db.update("update tenants set name=coalesce(?,name),business_type=coalesce(?,business_type),legal_name=coalesce(?,legal_name),tax_id=coalesce(?,tax_id),address=coalesce(?,address),phone=coalesce(?,phone),logo_url=coalesce(?,logo_url),plan=coalesce(?,plan) where id=?",x.get("name"),x.get("businessType"),x.get("legalName"),x.get("taxId"),x.get("address"),x.get("phone"),x.get("logoUrl"),x.get("plan"),t);return profile(j);}
 @GetMapping("/users") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')") List<Map<String,Object>> users(@AuthenticationPrincipal Jwt j){UUID t=tenant(j);ctx(t);return db.queryForList("select id,email,role,full_name,identification,address,phone from app_users where tenant_id=? order by full_name,email",t);}
 public record UserInput(String email, String password, String role, UUID branchId, String fullName, String identification, String address, String phone) {}
 @PostMapping("/users") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
 Map<String,Object> createUser(@AuthenticationPrincipal Jwt j,@RequestBody UserInput in) {
   if (in==null || in.email()==null || in.password()==null || in.password().length()<8 || in.role()==null)
     throw new IllegalArgumentException("email, password y role son obligatorios");
   String creator=j.getClaimAsString("scope"); String role=in.role().toUpperCase(Locale.ROOT);
   boolean allowed="SUPER_ADMIN".equals(creator) || ("TENANT_ADMIN".equals(creator)
       && Set.of("MANAGER","SELLER","DELIVERY","TECHNICIAN","ACCOUNTANT").contains(role))
       || ("MANAGER".equals(creator) && Set.of("SELLER","DELIVERY","TECHNICIAN","ACCOUNTANT").contains(role));
   if (!allowed) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"No puede asignar este rol");
   UUID t=tenant(j); ctx(t); UUID id=UUID.randomUUID();
   db.update("insert into app_users(id,tenant_id,email,password_hash,role,full_name,identification,address,phone) values(?,?,?,?,?,?,?,?,?)",id,t,in.email().trim().toLowerCase(),passwords.hash(in.password()),role,in.fullName(),in.identification(),in.address(),in.phone());
   if(in.branchId()!=null && db.update("insert into user_branches(user_id,branch_id,tenant_id) select ?,id,? from branches where id=? and tenant_id=? on conflict do nothing",id,t,in.branchId(),t)!=1)
     throw new IllegalArgumentException("La sucursal no pertenece a la empresa");
   return db.queryForMap("select id,email,role,full_name,identification,address,phone from app_users where id=?",id);
 }
 @PutMapping("/users/{userId}/branches/{branchId}") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") void assign(@AuthenticationPrincipal Jwt j,@PathVariable UUID userId,@PathVariable UUID branchId){UUID t=tenant(j);ctx(t);if(db.update("insert into user_branches(user_id,branch_id,tenant_id) select u.id,b.id,? from app_users u,branches b where u.id=? and b.id=? and u.tenant_id=? and b.tenant_id=? on conflict do nothing",t,userId,branchId,t,t)!=1)throw new IllegalArgumentException("Usuario o sucursal no pertenecen a la empresa");}
 @GetMapping("/branches") @PreAuthorize("isAuthenticated()") List<Map<String,Object>> branches(@AuthenticationPrincipal Jwt j){UUID t=tenant(j);ctx(t);return db.queryForList("select id,name,active from branches where tenant_id=? order by name",t);}
}
