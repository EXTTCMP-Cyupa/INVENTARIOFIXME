package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.fixme.application.ModuleService;

/** Tenant-scoped CRUD for the operational modules. SQL is deliberately kept here as a
 * thin adapter; business boundaries remain enforced by module checks, JWT tenant and RLS. */
@RestController
public class BusinessModulesController {
  private final JdbcTemplate db; private final ModuleService modules;
  public BusinessModulesController(JdbcTemplate db, ModuleService modules){this.db=db;this.modules=modules;}
  private UUID tenant(Jwt j){try{return UUID.fromString(Objects.requireNonNull(j.getClaimAsString("tenant_id")));}catch(Exception e){throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Tenant inválido");}}
  private void ctx(UUID t){db.queryForObject("select set_config('app.tenant_id',?,true)",String.class,t.toString());}
  private UUID id(String s){try{return UUID.fromString(s);}catch(Exception e){throw new IllegalArgumentException("Identificador inválido");}}
  private Map<String,Object> row(Map<String,Object> r){return r;}
  private void required(Map<String,Object> b,String... keys){for(String k:keys)if(b==null||b.get(k)==null||b.get(k).toString().isBlank())throw new IllegalArgumentException(k+" es obligatorio");}

  @GetMapping("/api/customers") @PreAuthorize("isAuthenticated()")
  public List<Map<String,Object>> customers(@AuthenticationPrincipal Jwt j){UUID t=tenant(j);modules.require(t,"CUSTOMERS");ctx(t);return db.queryForList("select id,name,email,phone,address,city,created_at from customers where tenant_id=? order by name",t);}
  @PostMapping("/api/customers") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String,Object>> createCustomer(@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"CUSTOMERS");required(b,"name");ctx(t);UUID id=UUID.randomUUID();db.update("insert into customers(id,tenant_id,name,email,phone,address,city) values(?,?,?,?,?,?,?)",id,t,b.get("name"),b.get("email"),b.get("phone"),b.get("address"),b.get("city"));return ResponseEntity.status(201).body(db.queryForMap("select * from customers where id=?",id));}
  @PutMapping("/api/customers/{id}") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public Map<String,Object> updateCustomer(@PathVariable String id,@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"CUSTOMERS");required(b,"name");ctx(t);db.update("update customers set name=?,email=?,phone=?,address=?,city=? where id=? and tenant_id=?",b.get("name"),b.get("email"),b.get("phone"),b.get("address"),b.get("city"),id(id),t);return db.queryForMap("select * from customers where id=?",id(id));}
  @DeleteMapping("/api/customers/{id}") @PreAuthorize("hasAuthority('SCOPE_TENANT_ADMIN')")
  public ResponseEntity<Void> deleteCustomer(@PathVariable String id,@AuthenticationPrincipal Jwt j){UUID t=tenant(j);modules.require(t,"CUSTOMERS");ctx(t);db.update("delete from customers where id=? and tenant_id=?",id(id),t);return ResponseEntity.noContent().build();}

  @GetMapping("/api/deliveries") @PreAuthorize("isAuthenticated()")
  public List<Map<String,Object>> deliveries(@AuthenticationPrincipal Jwt j,@RequestParam(required=false) String status){UUID t=tenant(j);modules.require(t,"DELIVERIES");ctx(t);return status==null?db.queryForList("select * from deliveries where tenant_id=? order by created_at desc",t):db.queryForList("select * from deliveries where tenant_id=? and status=? order by created_at desc",t,status);}
  @PostMapping("/api/deliveries") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SELLER','SCOPE_DELIVERY','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String,Object>> createDelivery(@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"DELIVERIES");required(b,"address");ctx(t);UUID x=UUID.randomUUID();db.update("insert into deliveries(id,tenant_id,sale_id,customer_id,branch_id,address,courier,latitude,longitude,evidence_url,evidence_metadata) values(?,?,?,?,?,?,?,?,?,?,?::jsonb)",x,t,uuidOrNull(b.get("saleId")),uuidOrNull(b.get("customerId")),uuidOrNull(b.get("branchId")),b.get("address"),b.get("courier"),b.get("latitude"),b.get("longitude"),b.get("evidenceUrl"),b.getOrDefault("evidenceMetadata","{}"));return ResponseEntity.status(201).body(db.queryForMap("select * from deliveries where id=?",x));}
  @PatchMapping("/api/deliveries/{id}/status") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_DELIVERY','SCOPE_SUPER_ADMIN')")
  public Map<String,Object> deliveryStatus(@PathVariable String id,@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"DELIVERIES");required(b,"status");ctx(t);db.update("update deliveries set status=?,courier=coalesce(?,courier),updated_at=now() where id=? and tenant_id=?",b.get("status"),b.get("courier"),id(id),t);return db.queryForMap("select * from deliveries where id=?",id(id));}

  @GetMapping("/api/work-orders") @PreAuthorize("isAuthenticated()")
  public List<Map<String,Object>> orders(@AuthenticationPrincipal Jwt j){UUID t=tenant(j);modules.require(t,"WORK_ORDERS");ctx(t);return db.queryForList("select id,customer_id,branch_id,description,diagnosis,quote,status,approval_url,approval_expires_at,created_at from work_orders where tenant_id=? order by created_at desc",t);}
  @PostMapping("/api/work-orders") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String,Object>> createOrder(@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"WORK_ORDERS");required(b,"customerId","description");ctx(t);UUID x=UUID.randomUUID();String raw=t+"."+UUID.randomUUID();String hash=sha(raw);OffsetDateTime exp=OffsetDateTime.now().plusDays(7);String url="/api/auth/work-orders/approve?token="+raw;db.update("insert into work_orders(id,tenant_id,customer_id,branch_id,description,diagnosis,quote,approval_token_hash,approval_expires_at,approval_url) values(?,?,?,?,?,?,?,?,?,?)",x,t,id(b.get("customerId").toString()),uuidOrNull(b.get("branchId")),b.get("description"),b.get("diagnosis"),decimal(b.get("quote")),hash,exp,url);return ResponseEntity.status(201).body(db.queryForMap("select id,customer_id,description,diagnosis,quote,status,approval_url,approval_expires_at from work_orders where id=?",x));}
  @PatchMapping("/api/work-orders/{id}/status") @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public Map<String,Object> orderStatus(@PathVariable String id,@AuthenticationPrincipal Jwt j,@RequestBody Map<String,Object>b){UUID t=tenant(j);modules.require(t,"WORK_ORDERS");required(b,"status");ctx(t);db.update("update work_orders set status=?,updated_at=now() where id=? and tenant_id=?",b.get("status"),id(id),t);return db.queryForMap("select * from work_orders where id=?",id(id));}
  @GetMapping(value={"/api/public/work-orders/approve","/public/work-orders/approve","/api/auth/work-orders/approve"}, produces=MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<String> publicOrder(@RequestParam String token) {
    String[] p=token.split("\\.",2);
    if(p.length!=2) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Token inválido");
    UUID t=id(p[0]); ctx(t);
    List<Map<String,Object>> rows=db.queryForList("select w.description,w.diagnosis,w.quote,w.status,w.approval_expires_at,c.name customer from work_orders w join customers c on c.id=w.customer_id where w.tenant_id=? and w.approval_token_hash=?",t,sha(token));
    if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.GONE,"Orden no encontrada o autorización ya utilizada");
    Map<String,Object> r=rows.get(0); OffsetDateTime expiry=(OffsetDateTime)r.get("approval_expires_at");
    boolean active=expiry.isAfter(OffsetDateTime.now()) && Set.of("OPEN","DIAGNOSIS","QUOTED").contains(String.valueOf(r.get("status")));
    String actions=active
      ? "<div class='actions'><form method='post'><input type='hidden' name='token' value='"+html(token)+"'><input type='hidden' name='accepted' value='true'><button class='approve'>Aprobar cotización</button></form><form method='post'><input type='hidden' name='token' value='"+html(token)+"'><input type='hidden' name='accepted' value='false'><button class='reject'>Rechazar</button></form></div>"
      : "<p class='notice'>Esta autorización ya no está disponible. Estado actual: <b>"+html(String.valueOf(r.get("status")))+"</b></p>";
    String page="<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Autorización FixmeTiendas</title><style>body{margin:0;background:#f7f8fc;color:#172033;font:15px Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:20px}.card{background:#fff;border:1px solid #e7eaf0;border-radius:18px;padding:28px;width:min(520px,100%);box-shadow:0 16px 45px #17203314}h1{margin:0 0 8px;color:#3157d5}h2{font-size:18px;margin-top:26px}.muted{color:#667085}.quote{font-size:30px;font-weight:800;color:#3157d5;margin:12px 0}.actions{display:flex;gap:10px;margin-top:24px}button{border:0;border-radius:10px;padding:13px 16px;font-weight:700;cursor:pointer}.approve{background:#3157d5;color:#fff}.reject{background:#fff0f1;color:#bd3f4e}.notice{padding:14px;background:#fff7df;border-radius:10px;color:#866519}</style></head><body><main class='card'><h1>FixmeTiendas</h1><p class='muted'>Autorización de orden de servicio</p><h2>Cliente</h2><p>"+html(String.valueOf(r.get("customer")))+"</p><h2>Servicio solicitado</h2><p>"+html(String.valueOf(r.get("description")))+"</p><h2>Diagnóstico</h2><p>"+html(String.valueOf(r.get("diagnosis")==null?"Pendiente":r.get("diagnosis")))+"</p><div class='quote'>$"+html(String.valueOf(r.get("quote")==null?"0.00":r.get("quote")))+"</div><p class='muted'>Estado: <b>"+html(String.valueOf(r.get("status")))+"</b></p>"+actions+"</main></body></html>";
    return ResponseEntity.ok(page);
  }
  @PostMapping({"/api/public/work-orders/approve","/public/work-orders/approve","/api/auth/work-orders/approve"}) public Map<String,Object> approve(@RequestParam String token,@RequestParam boolean accepted){String[] p=token.split("\\.",2);if(p.length!=2)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Token inválido");UUID t=id(p[0]);ctx(t);List<Map<String,Object>> rows=db.queryForList("select id,status,approval_expires_at from work_orders where tenant_id=? and approval_token_hash=?",t,sha(token));if(rows.isEmpty()||((OffsetDateTime)rows.get(0).get("approval_expires_at")).isBefore(OffsetDateTime.now()))throw new ResponseStatusException(HttpStatus.GONE,"Token expirado o inválido");db.update("update work_orders set status=?,approval_token_hash=null where id=?",accepted?"APPROVED":"REJECTED",rows.get(0).get("id"));return Map.of("message",accepted?"Orden aprobada":"Orden rechazada");}
  private String html(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}

  @GetMapping("/api/reports/summary") @PreAuthorize("isAuthenticated()")
  public Map<String,Object> summary(@AuthenticationPrincipal Jwt j,@RequestParam(required=false) String branchId,@RequestParam(required=false) String from,@RequestParam(required=false) String to){UUID t=tenant(j);modules.require(t,"REPORTS");ctx(t);String filter=" tenant_id=? "+(branchId!=null?"and branch_id=? ":"");List<Object> args=new ArrayList<>();args.add(t);if(branchId!=null)args.add(id(branchId));if(from!=null&&!from.isBlank()){filter+="and created_at >= ?::date ";args.add(from);}if(to!=null&&!to.isBlank()){filter+="and created_at < (?::date + interval '1 day') ";args.add(to);}Map<String,Object> out=new LinkedHashMap<>();out.put("sales",db.queryForObject("select count(*) from sales where "+filter,args.toArray(),Long.class));out.put("revenue",db.queryForObject("select coalesce(sum(total),0) from sales where "+filter,args.toArray(),BigDecimal.class));out.put("lowStock",db.queryForObject("select count(*) from product_stock ps join products p on p.id=ps.product_id where p.tenant_id=? and ps.stock<=5",new Object[]{t},Long.class));out.put("period",Map.of("from",from==null?"":from,"to",to==null?"":to));return out;}
  private UUID uuidOrNull(Object x){return x==null||x.toString().isBlank()?null:id(x.toString());}
  private BigDecimal decimal(Object x){return x==null?null:new BigDecimal(x.toString());}
  private String sha(String x){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(x.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
