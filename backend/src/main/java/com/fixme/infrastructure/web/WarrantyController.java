package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import com.fixme.application.ModuleService;

@RestController
@RequestMapping("/api/warranties")
public class WarrantyController {
  private final JdbcTemplate db; private final ModuleService modules;
  public WarrantyController(JdbcTemplate db, ModuleService modules){this.db=db;this.modules=modules;}
  private UUID tenant(Jwt j){return UUID.fromString(j.getClaimAsString("tenant_id"));}
  private void ctx(UUID t){db.queryForObject("select set_config('app.tenant_id',?,true)",String.class,t.toString());}
  @GetMapping @PreAuthorize("isAuthenticated()")
  public List<Map<String,Object>> list(@AuthenticationPrincipal Jwt j,@RequestParam(required=false) String saleId){
    UUID t=tenant(j); modules.require(t,"POS"); ctx(t);
    return saleId==null?db.queryForList("select * from warranties where tenant_id=? order by created_at desc",t):
      db.queryForList("select * from warranties where tenant_id=? and sale_id=? order by created_at desc",t,UUID.fromString(saleId));
  }
  public record Input(UUID saleId, UUID saleItemId, UUID productId, UUID customerId, Integer days,
                      String expiresAt, String terms){}
  @PostMapping @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String,Object>> create(@AuthenticationPrincipal Jwt j,@RequestBody Input in){
    if(in==null||in.saleId()==null||in.productId()==null) throw new IllegalArgumentException("venta y producto son obligatorios");
    UUID t=tenant(j);modules.require(t,"POS");ctx(t);
    db.queryForObject("select id from sales where id=? and tenant_id=?",UUID.class,in.saleId());
    db.queryForObject("select id from products where id=? and tenant_id=?",UUID.class,in.productId());
    OffsetDateTime expiry=in.expiresAt()==null||in.expiresAt().isBlank()
        ? OffsetDateTime.now().plusDays(in.days()==null?365:in.days())
        : OffsetDateTime.parse(in.expiresAt());
    if(!expiry.isAfter(OffsetDateTime.now())) throw new IllegalArgumentException("La fecha de vencimiento debe ser futura");
    UUID id=UUID.randomUUID();
    db.update("insert into warranties(id,tenant_id,sale_id,sale_item_id,product_id,customer_id,expires_at,terms) values(?,?,?,?,?,?,?,?)",id,t,in.saleId(),in.saleItemId(),in.productId(),in.customerId(),expiry,in.terms());
    return ResponseEntity.status(HttpStatus.CREATED).body(db.queryForMap("select * from warranties where id=?",id));
  }
  @PatchMapping("/{id}/claim") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public Map<String,Object> claim(@PathVariable UUID id,@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object> body){
    UUID t=tenant(j);modules.require(t,"POS");ctx(t);
    db.update("update warranties set status='CLAIMED',claim_notes=?,updated_at=now() where id=? and tenant_id=? and status='ACTIVE'",body==null?null:body.get("notes"),id,t);
    return db.queryForMap("select * from warranties where id=? and tenant_id=?",id,t);
  }
}
