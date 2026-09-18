package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.fixme.application.PasswordHasher;

@RestController
@RequestMapping("/api/platform")
@PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SUPER_ADMIN')")
public class PlatformAdministrationController {
  private final JdbcTemplate db;
  private final PasswordHasher passwords;

  public PlatformAdministrationController(JdbcTemplate db, PasswordHasher passwords) {
    this.db = db;
    this.passwords = passwords;
  }

  @GetMapping("/stats")
  public Map<String, Object> platformStats() {
    Map<String, Object> stats = new LinkedHashMap<>();
    int totalTenants = db.queryForObject("select count(*) from tenants", Integer.class);
    int activeTenants = db.queryForObject("select count(*) from tenants where subscription_status = 'ACTIVE'", Integer.class);
    int pastDueTenants = db.queryForObject("select count(*) from tenants where subscription_status = 'PAST_DUE' or (subscription_status = 'ACTIVE' and next_billing_date <= CURRENT_DATE)", Integer.class);
    int suspendedTenants = db.queryForObject("select count(*) from tenants where subscription_status = 'SUSPENDED'", Integer.class);
    BigDecimal mrr = db.queryForObject("select coalesce(sum(monthly_fee), 0) from tenants where subscription_status = 'ACTIVE'", BigDecimal.class);
    BigDecimal collectedThisMonth = db.queryForObject("select coalesce(sum(amount), 0) from tenant_subscription_payments where payment_date >= date_trunc('month', CURRENT_DATE)", BigDecimal.class);
    int totalUsers = db.queryForObject("select count(*) from app_users", Integer.class);
    int totalProducts = db.queryForObject("select count(*) from products", Integer.class);
    int totalOrders = db.queryForObject("select count(*) from work_orders", Integer.class);

    stats.put("totalTenants", totalTenants);
    stats.put("activeTenants", activeTenants);
    stats.put("pastDueTenants", pastDueTenants);
    stats.put("suspendedTenants", suspendedTenants);
    stats.put("mrr", mrr);
    stats.put("collectedThisMonth", collectedThisMonth);
    stats.put("totalUsers", totalUsers);
    stats.put("totalProducts", totalProducts);
    stats.put("totalOrders", totalOrders);
    return stats;
  }

  @GetMapping("/tenants")
  public List<Map<String, Object>> tenants(@RequestParam(required = false) String q) {
    String sql = """
        select t.id, t.name, t.business_type, t.plan, t.subscription_status, t.limits,
               coalesce(t.monthly_fee, 49.00) as monthly_fee,
               coalesce(t.billing_cycle, 'MONTHLY') as billing_cycle,
               coalesce(t.discount_percent, 0.00) as discount_percent,
               coalesce(t.next_billing_date, (CURRENT_DATE + 30)::date) as next_billing_date,
               t.last_payment_date,
               coalesce(t.payment_status, 'PAID') as payment_status,
               t.admin_notes, t.created_at, t.phone as store_phone,
               t.billing_contact_name, t.billing_contact_phone, t.billing_contact_email,
               (coalesce(t.next_billing_date, (CURRENT_DATE + 30)::date) - CURRENT_DATE)::integer as days_until_due,
               u.email as owner_email, u.full_name as owner_name, u.phone as owner_phone,
               (select count(*) from app_users where tenant_id = t.id) as user_count,
               (select count(*) from products where tenant_id = t.id) as product_count,
               (select count(*) from work_orders where tenant_id = t.id) as order_count
        from tenants t
        left join lateral (
          select email, full_name, phone
          from app_users
          where tenant_id = t.id and role in ('MANAGER', 'TENANT_ADMIN')
          order by (role = 'TENANT_ADMIN') desc, created_at asc
          limit 1
        ) u on true
        """;

    if (q == null || q.isBlank()) {
      return db.queryForList(sql + " order by (t.subscription_status = 'SUSPENDED') asc, t.next_billing_date asc, t.name asc");
    }
    String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
    return db.queryForList(sql + " where lower(t.name) like ? or lower(coalesce(u.email,'')) like ? or lower(coalesce(u.full_name,'')) like ? order by t.name asc",
        pattern, pattern, pattern);
  }

  @PostMapping("/tenants")
  public Map<String, Object> create(@RequestBody Map<String, Object> input, @AuthenticationPrincipal Jwt jwt) {
    UUID id = UUID.randomUUID();
    String name = String.valueOf(required(input, "name"));
    String plan = input.get("plan") != null ? String.valueOf(input.get("plan")).toUpperCase(Locale.ROOT) : "STARTER";
    String businessType = input.get("businessType") != null ? String.valueOf(input.get("businessType")).toUpperCase(Locale.ROOT) : "RETAIL";
    String storePhone = input.get("phone") != null ? String.valueOf(input.get("phone")) : null;
    String billingCycle = input.get("billingCycle") != null ? String.valueOf(input.get("billingCycle")).toUpperCase(Locale.ROOT) : "MONTHLY";
    BigDecimal discountPercent = BigDecimal.ZERO;
    if (input.get("discountPercent") != null && !input.get("discountPercent").toString().isBlank()) {
      try {
        discountPercent = new BigDecimal(input.get("discountPercent").toString());
      } catch (Exception ignored) {}
    }

    BigDecimal monthlyFee = new BigDecimal("49.00");
    if (input.get("monthlyFee") != null && !input.get("monthlyFee").toString().isBlank()) {
      try {
        monthlyFee = new BigDecimal(input.get("monthlyFee").toString());
      } catch (Exception ignored) {}
    }

    String billingContactName = input.get("billingContactName") != null ? String.valueOf(input.get("billingContactName")) : null;
    String billingContactPhone = input.get("billingContactPhone") != null ? String.valueOf(input.get("billingContactPhone")) : null;
    String billingContactEmail = input.get("billingContactEmail") != null ? String.valueOf(input.get("billingContactEmail")) : null;
    String adminNotes = input.get("adminNotes") != null ? String.valueOf(input.get("adminNotes")) : null;

    db.update("""
        insert into tenants(id, name, plan, subscription_status, payment_status, monthly_fee, billing_cycle, discount_percent, next_billing_date, last_payment_date, business_type, phone, billing_contact_name, billing_contact_phone, billing_contact_email, admin_notes)
        values(?, ?, ?, 'ACTIVE', 'PAID', ?, ?, ?, CURRENT_DATE + interval '30 days', CURRENT_DATE, ?, ?, ?, ?, ?, ?)
        """,
        id, name, plan, monthlyFee, billingCycle, discountPercent, businessType, storePhone, billingContactName, billingContactPhone, billingContactEmail, adminNotes);

    ctx(id);
    String ownerEmail = String.valueOf(input.getOrDefault("ownerEmail", "")).trim().toLowerCase(Locale.ROOT);
    String ownerPassword = String.valueOf(input.getOrDefault("ownerPassword", ""));
    String ownerName = input.get("ownerName") != null ? String.valueOf(input.get("ownerName")) : "Manager " + name;
    String ownerPhone = input.get("ownerPhone") != null ? String.valueOf(input.get("ownerPhone")) : storePhone;

    if (ownerEmail.isBlank() || ownerPassword.length() < 8) {
      throw new IllegalArgumentException("ownerEmail y ownerPassword de mínimo 8 caracteres son obligatorios");
    }

    UUID branch = UUID.randomUUID();
    UUID owner = UUID.randomUUID();
    db.update("insert into branches(id, tenant_id, name) values(?, ?, ?)", branch, id, "Principal");
    db.update("insert into app_users(id, tenant_id, email, password_hash, role, full_name, phone) values(?, ?, ?, ?, 'MANAGER', ?, ?)",
        owner, id, ownerEmail, passwords.hash(ownerPassword), ownerName, ownerPhone);

    // Initial default role permissions for the new store
    db.update("""
        insert into role_permissions(id, tenant_id, role, permissions, updated_at) values
        (uuid_generate_v4(), ?, 'MANAGER', ARRAY['home','cash','pos','sales','administration','products','customers','deliveries','work-orders','my-work','warranties','reports'], now()),
        (uuid_generate_v4(), ?, 'TECHNICIAN', ARRAY['home','my-work','work-orders','warranties','customers'], now()),
        (uuid_generate_v4(), ?, 'SELLER', ARRAY['home','cash','pos','sales','products','customers','work-orders','warranties'], now()),
        (uuid_generate_v4(), ?, 'DELIVERY', ARRAY['home','customers','deliveries'], now()),
        (uuid_generate_v4(), ?, 'ACCOUNTANT', ARRAY['home','cash','sales','reports'], now())
        on conflict(tenant_id, role) do nothing
        """, id, id, id, id, id);

    audit(jwt, id, "TENANT_CREATED", Map.of("name", name, "plan", plan, "monthlyFee", monthlyFee, "owner", ownerEmail));
    return db.queryForMap("select id, name, business_type, plan, subscription_status, monthly_fee, billing_cycle, discount_percent, next_billing_date from tenants where id = ?", id);
  }

  @PatchMapping("/tenants/{tenantId}")
  public Map<String, Object> update(
      @PathVariable UUID tenantId,
      @RequestBody Map<String, Object> input,
      @AuthenticationPrincipal Jwt jwt
  ) {
    if (input.containsKey("plan")) {
      db.update("update tenants set plan = ? where id = ?", input.get("plan"), tenantId);
    }
    if (input.containsKey("subscriptionStatus")) {
      db.update("update tenants set subscription_status = ? where id = ?", input.get("subscriptionStatus"), tenantId);
    }
    if (input.containsKey("paymentStatus")) {
      db.update("update tenants set payment_status = ? where id = ?", input.get("paymentStatus"), tenantId);
    }
    if (input.containsKey("monthlyFee") && input.get("monthlyFee") != null) {
      db.update("update tenants set monthly_fee = ? where id = ?", new BigDecimal(input.get("monthlyFee").toString()), tenantId);
    }
    if (input.containsKey("billingCycle") && input.get("billingCycle") != null) {
      db.update("update tenants set billing_cycle = ? where id = ?", input.get("billingCycle").toString().toUpperCase(Locale.ROOT), tenantId);
    }
    if (input.containsKey("discountPercent") && input.get("discountPercent") != null) {
      db.update("update tenants set discount_percent = ? where id = ?", new BigDecimal(input.get("discountPercent").toString()), tenantId);
    }
    if (input.containsKey("adminNotes")) {
      db.update("update tenants set admin_notes = ? where id = ?", input.get("adminNotes"), tenantId);
    }
    if (input.containsKey("billingContactName")) {
      db.update("update tenants set billing_contact_name = ? where id = ?", input.get("billingContactName"), tenantId);
    }
    if (input.containsKey("billingContactPhone")) {
      db.update("update tenants set billing_contact_phone = ? where id = ?", input.get("billingContactPhone"), tenantId);
    }
    if (input.containsKey("billingContactEmail")) {
      db.update("update tenants set billing_contact_email = ? where id = ?", input.get("billingContactEmail"), tenantId);
    }
    if (input.containsKey("nextBillingDate") && input.get("nextBillingDate") != null) {
      db.update("update tenants set next_billing_date = ?::date where id = ?", input.get("nextBillingDate").toString(), tenantId);
    }

    audit(jwt, tenantId, "TENANT_UPDATED", input);
    return db.queryForMap("select id, name, business_type, plan, subscription_status, monthly_fee, billing_cycle, discount_percent, next_billing_date, payment_status, admin_notes from tenants where id = ?", tenantId);
  }

  @PatchMapping("/tenants/{tenantId}/rate")
  public Map<String, Object> updateRate(
      @PathVariable UUID tenantId,
      @RequestBody Map<String, Object> input,
      @AuthenticationPrincipal Jwt jwt
  ) {
    if (input.containsKey("monthlyFee") && input.get("monthlyFee") != null) {
      db.update("update tenants set monthly_fee = ? where id = ?", new BigDecimal(input.get("monthlyFee").toString()), tenantId);
    }
    if (input.containsKey("billingCycle") && input.get("billingCycle") != null) {
      db.update("update tenants set billing_cycle = ? where id = ?", input.get("billingCycle").toString().toUpperCase(Locale.ROOT), tenantId);
    }
    if (input.containsKey("discountPercent") && input.get("discountPercent") != null) {
      db.update("update tenants set discount_percent = ? where id = ?", new BigDecimal(input.get("discountPercent").toString()), tenantId);
    }
    if (input.containsKey("plan") && input.get("plan") != null) {
      db.update("update tenants set plan = ? where id = ?", input.get("plan").toString().toUpperCase(Locale.ROOT), tenantId);
    }
    if (input.containsKey("nextBillingDate") && input.get("nextBillingDate") != null) {
      db.update("update tenants set next_billing_date = ?::date where id = ?", input.get("nextBillingDate").toString(), tenantId);
    }
    if (input.containsKey("adminNotes")) {
      db.update("update tenants set admin_notes = ? where id = ?", input.get("adminNotes"), tenantId);
    }
    if (input.containsKey("billingContactName")) {
      db.update("update tenants set billing_contact_name = ? where id = ?", input.get("billingContactName"), tenantId);
    }
    if (input.containsKey("billingContactPhone")) {
      db.update("update tenants set billing_contact_phone = ? where id = ?", input.get("billingContactPhone"), tenantId);
    }
    if (input.containsKey("billingContactEmail")) {
      db.update("update tenants set billing_contact_email = ? where id = ?", input.get("billingContactEmail"), tenantId);
    }

    audit(jwt, tenantId, "RATE_UPDATED", input);
    return db.queryForMap("""
        select id, name, plan, subscription_status, payment_status, monthly_fee,
               coalesce(billing_cycle, 'MONTHLY') as billing_cycle,
               coalesce(discount_percent, 0.00) as discount_percent,
               next_billing_date, admin_notes, billing_contact_name, billing_contact_phone, billing_contact_email
        from tenants where id = ?
        """, tenantId);
  }

  @PatchMapping("/tenants/{tenantId}/suspend")
  public Map<String, Object> suspendTenant(@PathVariable UUID tenantId, @AuthenticationPrincipal Jwt jwt) {
    db.update("update tenants set subscription_status = 'SUSPENDED', payment_status = 'OVERDUE' where id = ?", tenantId);
    audit(jwt, tenantId, "TENANT_SUSPENDED", Map.of("reason", "Suspended by platform admin"));
    return db.queryForMap("select id, name, subscription_status, payment_status from tenants where id = ?", tenantId);
  }

  @PatchMapping("/tenants/{tenantId}/reactivate")
  public Map<String, Object> reactivateTenant(@PathVariable UUID tenantId, @AuthenticationPrincipal Jwt jwt) {
    db.update("update tenants set subscription_status = 'ACTIVE', payment_status = 'PAID' where id = ?", tenantId);
    audit(jwt, tenantId, "TENANT_REACTIVATED", Map.of("reason", "Reactivated by platform admin"));
    return db.queryForMap("select id, name, subscription_status, payment_status from tenants where id = ?", tenantId);
  }

  @PostMapping("/tenants/{tenantId}/payments")
  public Map<String, Object> recordPayment(
      @PathVariable UUID tenantId,
      @RequestBody Map<String, Object> input,
      @AuthenticationPrincipal Jwt jwt
  ) {
    BigDecimal amount = input.get("amount") != null ? new BigDecimal(input.get("amount").toString()) : new BigDecimal("49.00");
    String period = input.get("periodCovered") != null ? String.valueOf(input.get("periodCovered")) : "Mensualidad";
    String method = input.get("paymentMethod") != null ? String.valueOf(input.get("paymentMethod")) : "TRANSFER";
    String ref = input.get("reference") != null ? String.valueOf(input.get("reference")) : null;
    String notes = input.get("notes") != null ? String.valueOf(input.get("notes")) : null;
    String recordedBy = jwt.getSubject();

    UUID paymentId = UUID.randomUUID();
    db.update("""
        insert into tenant_subscription_payments (id, tenant_id, amount, payment_date, period_covered, payment_method, reference, recorded_by, notes)
        values (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?)
        """,
        paymentId, tenantId, amount, period, method, ref, recordedBy, notes);

    String cycle = "MONTHLY";
    try {
      cycle = db.queryForObject("select coalesce(billing_cycle, 'MONTHLY') from tenants where id = ?", String.class, tenantId);
    } catch (Exception ignored) {}

    String interval = switch (cycle != null ? cycle.toUpperCase(Locale.ROOT) : "MONTHLY") {
      case "ANNUAL" -> "365 days";
      case "SEMIANNUAL" -> "180 days";
      case "QUARTERLY" -> "90 days";
      default -> "30 days";
    };

    db.update(String.format("""
        update tenants
        set subscription_status = 'ACTIVE',
            payment_status = 'PAID',
            last_payment_date = CURRENT_DATE,
            next_billing_date = greatest(next_billing_date, CURRENT_DATE) + interval '%s'
        where id = ?
        """, interval), tenantId);

    audit(jwt, tenantId, "SUBSCRIPTION_PAYMENT_RECORDED", Map.of("amount", amount, "period", period, "reference", ref != null ? ref : ""));
    return db.queryForMap("select * from tenant_subscription_payments where id = ?", paymentId);
  }

  @GetMapping("/payments")
  public List<Map<String, Object>> getAllSubscriptionPayments(@RequestParam(required = false) String q) {
    String sql = """
        select p.id, p.tenant_id, t.name as tenant_name, t.plan,
               p.amount, p.payment_date, p.period_covered, p.payment_method,
               p.reference, p.recorded_by, p.notes, p.created_at
        from tenant_subscription_payments p
        join tenants t on t.id = p.tenant_id
        """;
    if (q != null && !q.isBlank()) {
      String pattern = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
      return db.queryForList(sql + " where lower(t.name) like ? or lower(coalesce(p.reference, '')) like ? or lower(coalesce(p.period_covered, '')) like ? order by p.payment_date desc, p.created_at desc",
          pattern, pattern, pattern);
    }
    return db.queryForList(sql + " order by p.payment_date desc, p.created_at desc");
  }

  @GetMapping("/tenants/{tenantId}/payments")
  public List<Map<String, Object>> getTenantPayments(@PathVariable UUID tenantId) {
    return db.queryForList("select * from tenant_subscription_payments where tenant_id = ? order by payment_date desc, created_at desc", tenantId);
  }

  @GetMapping("/tenants/{tenantId}/users")
  public List<Map<String, Object>> users(@PathVariable UUID tenantId) {
    ctx(tenantId);
    return db.queryForList("select id, email, role, full_name, identification, address, phone from app_users where tenant_id = ? order by full_name, email", tenantId);
  }

  @GetMapping("/tenants/{tenantId}/inventory")
  public Map<String, Object> inventory(@PathVariable UUID tenantId) {
    ctx(tenantId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tenantId", tenantId);
    result.put("products", db.queryForObject("select count(*) from products where tenant_id = ?", Integer.class, tenantId));
    result.put("units", db.queryForObject("select coalesce(sum(stock),0) from product_stock where product_id in (select id from products where tenant_id = ?)", Integer.class, tenantId));
    result.put("value", db.queryForObject("select coalesce(sum(ps.stock*p.price),0) from product_stock ps join products p on p.id=ps.product_id where p.tenant_id = ?", BigDecimal.class, tenantId));
    result.put("items", db.queryForList("select p.id, p.sku, p.name, p.price, coalesce(sum(ps.stock),0) stock from products p left join product_stock ps on ps.product_id=p.id where p.tenant_id = ? group by p.id order by p.name", tenantId));
    return result;
  }

  @GetMapping("/tenants/{tenantId}/overview")
  public Map<String, Object> overview(@PathVariable UUID tenantId) {
    ctx(tenantId);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("users", db.queryForObject("select count(*) from app_users where tenant_id = ?", Integer.class, tenantId));
    result.put("products", db.queryForObject("select count(*) from products where tenant_id = ?", Integer.class, tenantId));
    result.put("customers", db.queryForObject("select count(*) from customers where tenant_id = ?", Integer.class, tenantId));
    result.put("orders", db.queryForObject("select count(*) from work_orders where tenant_id = ?", Integer.class, tenantId));
    return result;
  }

  @PatchMapping("/tenants/{tenantId}/users/{userId}/role")
  public void role(
      @PathVariable UUID tenantId,
      @PathVariable UUID userId,
      @RequestBody Map<String, Object> input,
      @AuthenticationPrincipal Jwt jwt
  ) {
    String role = String.valueOf(input.getOrDefault("role", "")).toUpperCase(Locale.ROOT);
    if (!Set.of("SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "SELLER", "DELIVERY", "TECHNICIAN", "ACCOUNTANT").contains(role)) {
      throw new IllegalArgumentException("Rol inválido");
    }
    ctx(tenantId);
    if (db.update("update app_users set role = ? where id = ? and tenant_id = ?", role, userId, tenantId) != 1) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
    }
    audit(jwt, tenantId, "USER_ROLE_UPDATED", Map.of("userId", userId, "role", role));
  }

  @PatchMapping("/tenants/{tenantId}/modules/{key}")
  public void module(
      @PathVariable UUID tenantId,
      @PathVariable String key,
      @RequestBody Map<String, Object> input,
      @AuthenticationPrincipal Jwt jwt
  ) {
    ctx(tenantId);
    db.update("insert into tenant_modules(tenant_id,module_key,enabled) values(?,?,?) on conflict(tenant_id,module_key) do update set enabled=excluded.enabled,updated_at=now()",
        tenantId, key.toUpperCase(Locale.ROOT), Boolean.TRUE.equals(input.get("enabled")));
    audit(jwt, tenantId, "MODULE_UPDATED", Map.of("module", key, "enabled", input.get("enabled")));
  }

  private void ctx(UUID tenant) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
  }

  private void audit(Jwt jwt, UUID tenant, String action, Object detail) {
    db.update("insert into audit_log(tenant_id,actor_email,action,details) values(?,?,?,to_jsonb(?::text))",
        tenant, jwt.getSubject(), action, String.valueOf(detail).replace('=', ':'));
  }

  private Object required(Map<String, Object> m, String key) {
    Object v = m.get(key);
    if (v == null || String.valueOf(v).isBlank()) {
      throw new IllegalArgumentException(key + " es obligatorio");
    }
    return v;
  }
}
