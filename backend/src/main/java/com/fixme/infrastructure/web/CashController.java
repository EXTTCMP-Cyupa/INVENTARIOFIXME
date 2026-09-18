package com.fixme.infrastructure.web;
import com.fixme.application.*; import java.math.*; import java.time.*; import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.oauth2.jwt.Jwt; import org.springframework.security.core.annotation.AuthenticationPrincipal; import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/cash") public class CashController {
 private final CashService service; private final org.springframework.jdbc.core.JdbcTemplate db; public CashController(CashService s,org.springframework.jdbc.core.JdbcTemplate d){service=s;db=d;}
 record Open(BigDecimal openingCash,Map<String,BigDecimal> amounts){} record Movement(String type,String paymentMethod,BigDecimal amount,String reason){} record Close(Map<String,BigDecimal> counted){}
 private UUID tenant(Jwt j){return UUID.fromString(j.getClaimAsString("tenant_id"));} private UUID user(UUID t,String e){db.queryForObject("select set_config('app.tenant_id',?,true)",String.class,t.toString());return db.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)",UUID.class,t,e);} private UUID uid(Jwt j){return user(tenant(j),j.getSubject());}
 @PostMapping("/open") @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") CashPort.Session open(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId,@RequestBody Open x){return service.open(tenant(j),branchId,uid(j),x.openingCash(),x.amounts());}
 @GetMapping("/current") @PreAuthorize("isAuthenticated()") Optional<CashPort.Session> current(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId){return service.current(tenant(j),branchId);}
 @PostMapping("/movement") @PreAuthorize("hasAnyAuthority('SCOPE_SELLER','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") CashPort.Session movement(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId,@RequestBody Movement x){return service.movement(tenant(j),branchId,uid(j),x.type(),x.paymentMethod(),x.amount(),x.reason());}
 @PostMapping("/close") @PreAuthorize("hasAnyAuthority('SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") CashPort.Session close(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId,@RequestBody Close x){return service.close(tenant(j),branchId,uid(j),x.counted());}
 @GetMapping("/report") @PreAuthorize("hasAnyAuthority('SCOPE_ACCOUNTANT','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')") List<CashPort.Session> report(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId,@RequestParam @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) Instant from,@RequestParam @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) Instant to){return service.report(tenant(j),branchId,from,to);}
 @GetMapping("/movements") @PreAuthorize("hasAnyAuthority('SCOPE_ACCOUNTANT','SCOPE_MANAGER','SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
 List<Map<String,Object>> movements(@AuthenticationPrincipal Jwt j,@RequestParam UUID branchId,@RequestParam(required=false) UUID sessionId){
  UUID t=tenant(j); db.queryForObject("select set_config('app.tenant_id',?,true)",String.class,t.toString());
  return sessionId==null?db.queryForList("select id,session_id,type,payment_method,amount,reason,created_at from cash_movements where tenant_id=? and branch_id=? order by created_at desc limit 100",t,branchId):
   db.queryForList("select id,session_id,type,payment_method,amount,reason,created_at from cash_movements where tenant_id=? and branch_id=? and session_id=? order by created_at desc",t,branchId,sessionId);
 }
}
