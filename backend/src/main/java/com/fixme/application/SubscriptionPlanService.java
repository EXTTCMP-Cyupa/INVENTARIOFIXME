package com.fixme.application;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Array;
import java.util.*;

@Service
public class SubscriptionPlanService {

  private final JdbcTemplate db;
  public static final Set<String> ALL_AVAILABLE_MODULES = Set.of(
      "INVENTORY", "POS", "CASH_REGISTER", "QUOTES", "WORK_ORDERS", "DELIVERIES", "CUSTOMERS", "REPORTS", "APIS"
  );

  public SubscriptionPlanService(JdbcTemplate db) {
    this.db = db;
  }

  private void setTenantContext(UUID tenantId) {
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }

  // --- 1. PLAN CATALOG QUERIES ---

  public List<Map<String, Object>> getActivePlans() {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT code, name, description, monthly_price, included_modules, features,
               badge, is_popular, is_active, display_order
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order ASC, monthly_price ASC
        """);
    return formatPlanRows(rows);
  }

  public List<Map<String, Object>> getAllPlans() {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT p.code, p.name, p.description, p.monthly_price, p.included_modules, p.features,
               p.badge, p.is_popular, p.is_active, p.display_order, p.created_at, p.updated_at,
               (SELECT count(*) FROM tenants t WHERE UPPER(t.plan) = UPPER(p.code)) AS active_subscribers
        FROM subscription_plans p
        ORDER BY p.display_order ASC, p.monthly_price ASC
        """);
    return formatPlanRows(rows);
  }

  public Map<String, Object> getPlan(String code) {
    try {
      Map<String, Object> row = db.queryForMap("""
          SELECT code, name, description, monthly_price, included_modules, features,
                 badge, is_popular, is_active, display_order, created_at, updated_at
          FROM subscription_plans
          WHERE UPPER(code) = UPPER(?)
          """, code.trim());
      return formatPlanRow(row);
    } catch (EmptyResultDataAccessException e) {
      throw new IllegalArgumentException("Plan no encontrado: " + code);
    }
  }

  // --- 2. PLAN MANAGEMENT (TENANT_ADMIN / SAAS OWNER) ---

  @Transactional
  public Map<String, Object> createPlan(Map<String, Object> data) {
    String code = String.valueOf(data.get("code")).trim().toUpperCase(Locale.ROOT);
    String name = String.valueOf(data.get("name")).trim();
    String description = data.get("description") != null ? String.valueOf(data.get("description")) : "";
    BigDecimal price = data.get("monthlyPrice") != null ? new BigDecimal(data.get("monthlyPrice").toString()) : new BigDecimal("49.00");
    String badge = data.get("badge") != null ? String.valueOf(data.get("badge")) : null;
    boolean isPopular = Boolean.TRUE.equals(data.get("isPopular"));
    boolean isActive = data.get("isActive") == null || Boolean.TRUE.equals(data.get("isActive"));
    int displayOrder = data.get("displayOrder") != null ? ((Number) data.get("displayOrder")).intValue() : 10;

    List<String> modules = toStringList(data.get("includedModules"));
    if (modules.isEmpty()) {
      modules = List.of("INVENTORY", "CUSTOMERS", "REPORTS");
    }

    List<String> features = toStringList(data.get("features"));

    db.update("""
        INSERT INTO subscription_plans (code, name, description, monthly_price, included_modules, features, badge, is_popular, is_active, display_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?::text[], ?::text[], ?, ?, ?, ?, now(), now())
        """,
        code, name, description, price, toSqlArray(modules), toSqlArray(features), badge, isPopular, isActive, displayOrder
    );

    return getPlan(code);
  }

  @Transactional
  public Map<String, Object> updatePlan(String code, Map<String, Object> data) {
    Map<String, Object> existing = getPlan(code);
    String name = data.containsKey("name") ? String.valueOf(data.get("name")).trim() : (String) existing.get("name");
    String description = data.containsKey("description") ? String.valueOf(data.get("description")) : (String) existing.get("description");
    BigDecimal price = data.containsKey("monthlyPrice") ? new BigDecimal(data.get("monthlyPrice").toString()) : (BigDecimal) existing.get("monthlyPrice");
    String badge = data.containsKey("badge") ? (data.get("badge") != null ? String.valueOf(data.get("badge")) : null) : (String) existing.get("badge");
    boolean isPopular = data.containsKey("isPopular") ? Boolean.TRUE.equals(data.get("isPopular")) : (Boolean) existing.get("isPopular");
    boolean isActive = data.containsKey("isActive") ? Boolean.TRUE.equals(data.get("isActive")) : (Boolean) existing.get("isActive");
    int displayOrder = data.containsKey("displayOrder") ? ((Number) data.get("displayOrder")).intValue() : ((Number) existing.get("displayOrder")).intValue();

    List<String> modules = data.containsKey("includedModules") ? toStringList(data.get("includedModules")) : toStringList(existing.get("includedModules"));
    List<String> features = data.containsKey("features") ? toStringList(data.get("features")) : toStringList(existing.get("features"));

    db.update("""
        UPDATE subscription_plans
        SET name = ?, description = ?, monthly_price = ?, included_modules = ?::text[],
            features = ?::text[], badge = ?, is_popular = ?, is_active = ?, display_order = ?, updated_at = now()
        WHERE UPPER(code) = UPPER(?)
        """,
        name, description, price, toSqlArray(modules), toSqlArray(features), badge, isPopular, isActive, displayOrder, code.trim()
    );

    return getPlan(code);
  }

  @Transactional
  public void deletePlan(String code) {
    int subCount = db.queryForObject("SELECT count(*) FROM tenants WHERE UPPER(plan) = UPPER(?)", Integer.class, code.trim());
    if (subCount > 0) {
      // If there are tenants on this plan, don't hard delete; deactivate it
      db.update("UPDATE subscription_plans SET is_active = false, updated_at = now() WHERE UPPER(code) = UPPER(?)", code.trim());
    } else {
      db.update("DELETE FROM subscription_plans WHERE UPPER(code) = UPPER(?)", code.trim());
    }
  }

  // --- 3. TENANT MODULE MANAGEMENT & PLAN ASSIGNMENT ---

  public Map<String, Object> getTenantModules(UUID tenantId) {
    setTenantContext(tenantId);
    Map<String, Object> tenant = db.queryForMap("""
        SELECT t.id, t.name, t.plan, t.monthly_fee, t.subscription_status
        FROM tenants t WHERE t.id = ?
        """, tenantId);

    List<Map<String, Object>> moduleRows = db.queryForList("""
        SELECT module_key, enabled
        FROM tenant_modules
        WHERE tenant_id = ?
        """, tenantId);

    Map<String, Boolean> currentModules = new LinkedHashMap<>();
    for (String m : ALL_AVAILABLE_MODULES) {
      currentModules.put(m, false);
    }
    for (var r : moduleRows) {
      currentModules.put(String.valueOf(r.get("module_key")), Boolean.TRUE.equals(r.get("enabled")));
    }

    String planCode = tenant.get("plan") != null ? String.valueOf(tenant.get("plan")).toUpperCase(Locale.ROOT) : "PRO";
    Map<String, Object> plan = null;
    try {
      plan = getPlan(planCode);
    } catch (Exception ignored) {}

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tenantId", tenantId);
    result.put("tenantName", tenant.get("name"));
    result.put("currentPlan", planCode);
    result.put("monthlyFee", tenant.get("monthly_fee"));
    result.put("modules", currentModules);
    result.put("planDefaultModules", plan != null ? plan.get("includedModules") : List.of());
    return result;
  }

  @Transactional
  public Map<String, Object> updateTenantModules(UUID tenantId, Map<String, Boolean> modules) {
    setTenantContext(tenantId);
    for (Map.Entry<String, Boolean> entry : modules.entrySet()) {
      String key = entry.getKey().toUpperCase(Locale.ROOT);
      if (ALL_AVAILABLE_MODULES.contains(key)) {
        db.update("""
            INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_at)
            VALUES (?, ?, ?, now())
            ON CONFLICT (tenant_id, module_key) DO UPDATE
            SET enabled = EXCLUDED.enabled, updated_at = now()
            """, tenantId, key, entry.getValue());
      }
    }
    return getTenantModules(tenantId);
  }

  @Transactional
  public Map<String, Object> applyPlanToTenant(UUID tenantId, String planCode) {
    setTenantContext(tenantId);
    Map<String, Object> plan = getPlan(planCode);
    List<String> includedModules = toStringList(plan.get("includedModules"));
    BigDecimal price = (BigDecimal) plan.get("monthlyPrice");

    // 1. Update tenant plan and monthly fee
    db.update("""
        UPDATE tenants
        SET plan = ?, monthly_fee = ?
        WHERE id = ?
        """, planCode.toUpperCase(Locale.ROOT), price, tenantId);

    // 2. Enable modules belonging to the plan, disable the others
    for (String key : ALL_AVAILABLE_MODULES) {
      boolean shouldEnable = includedModules.contains(key);
      db.update("""
          INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_at)
          VALUES (?, ?, ?, now())
          ON CONFLICT (tenant_id, module_key) DO UPDATE
          SET enabled = EXCLUDED.enabled, updated_at = now()
          """, tenantId, key, shouldEnable);
    }

    return getTenantModules(tenantId);
  }

  // --- 4. TRIAL STORES & CONVERSION MANAGEMENT ---

  public List<Map<String, Object>> getTrialTenants() {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT t.id, t.name, t.plan, t.intended_plan, t.is_trial, t.subscription_status,
               t.trial_ends_at, (t.trial_ends_at - CURRENT_DATE) as days_remaining,
               t.monthly_fee, t.phone as tenant_phone, t.business_type, t.created_at,
               (SELECT u.email FROM app_users u WHERE u.tenant_id = t.id AND u.role IN ('ADMIN', 'MANAGER', 'TENANT_ADMIN') LIMIT 1) as contact_email,
               (SELECT u.full_name FROM app_users u WHERE u.tenant_id = t.id AND u.role IN ('ADMIN', 'MANAGER', 'TENANT_ADMIN') LIMIT 1) as contact_name,
               (SELECT COALESCE(NULLIF(u.phone, ''), t.phone) FROM app_users u WHERE u.tenant_id = t.id AND u.role IN ('ADMIN', 'MANAGER', 'TENANT_ADMIN') LIMIT 1) as contact_phone,
               (SELECT count(*) FROM products p WHERE p.tenant_id = t.id) as product_count,
               (SELECT count(*) FROM sales s WHERE s.tenant_id = t.id) as sale_count,
               (SELECT count(*) FROM work_orders w WHERE w.tenant_id = t.id) as work_order_count,
               (SELECT count(*) FROM customers c WHERE c.tenant_id = t.id) as customer_count,
               (SELECT array_agg(tm.module_key) FROM tenant_modules tm WHERE tm.tenant_id = t.id AND tm.enabled = true) as enabled_modules
        FROM tenants t
        WHERE t.is_trial = true
        ORDER BY t.trial_ends_at ASC, t.created_at DESC
        """);

    List<Map<String, Object>> result = new ArrayList<>();
    for (var r : rows) {
      Map<String, Object> map = new LinkedHashMap<>(r);
      List<String> enabledMods = toList(r.get("enabled_modules"));
      map.put("enabledModules", enabledMods);
      map.put("enabled_modules", enabledMods);
      int days = r.get("days_remaining") != null ? ((Number) r.get("days_remaining")).intValue() : 0;
      map.put("daysRemaining", days);
      map.put("days_remaining", days);
      result.add(map);
    }
    return result;
  }

  @Transactional
  public Map<String, Object> extendTrial(UUID tenantId, int additionalDays, String notes) {
    if (additionalDays <= 0) {
      throw new IllegalArgumentException("Los días a extender deben ser mayores a cero.");
    }
    setTenantContext(tenantId);

    db.update("""
        UPDATE tenants
        SET is_trial = true,
            subscription_status = 'TRIAL',
            trial_ends_at = GREATEST(COALESCE(trial_ends_at, CURRENT_DATE), CURRENT_DATE) + (? || ' days')::interval,
            next_billing_date = GREATEST(COALESCE(trial_ends_at, CURRENT_DATE), CURRENT_DATE) + (? || ' days')::interval
        WHERE id = ?
        """, additionalDays, additionalDays, tenantId);

    return getTenantTrialInfo(tenantId);
  }

  @Transactional
  public Map<String, Object> convertTrial(UUID tenantId, Map<String, Object> data) {
    setTenantContext(tenantId);
    String planCode = String.valueOf(data.getOrDefault("planCode", "PRO")).trim().toUpperCase(Locale.ROOT);

    Map<String, Object> plan = null;
    try {
      plan = getPlan(planCode);
    } catch (Exception ignored) {}

    BigDecimal price;
    if (data.containsKey("monthlyFee") && data.get("monthlyFee") != null && !String.valueOf(data.get("monthlyFee")).isBlank()) {
      price = new BigDecimal(data.get("monthlyFee").toString());
    } else if (plan != null && plan.get("monthlyPrice") != null) {
      price = new BigDecimal(plan.get("monthlyPrice").toString());
    } else {
      price = new BigDecimal("49.00");
    }

    String billingCycle = data.get("billingCycle") != null ? String.valueOf(data.get("billingCycle")).toUpperCase(Locale.ROOT) : "MONTHLY";

    // 1. Update tenant to converted active subscription
    db.update("""
        UPDATE tenants
        SET is_trial = false,
            plan = ?,
            monthly_fee = ?,
            subscription_status = 'ACTIVE',
            payment_status = 'PAID',
            billing_cycle = ?,
            next_billing_date = CURRENT_DATE + interval '30 days',
            last_payment_date = CURRENT_DATE
        WHERE id = ?
        """, planCode, price, billingCycle, tenantId);

    // 2. Configure modules: if customModules map provided, apply that; else apply plan's included_modules
    if (data.get("modules") instanceof Map<?, ?> customMods) {
      for (String m : ALL_AVAILABLE_MODULES) {
        boolean enabled = Boolean.TRUE.equals(customMods.get(m)) || Boolean.TRUE.equals(customMods.get(m.toLowerCase(Locale.ROOT)));
        db.update("""
            INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_at)
            VALUES (?, ?, ?, now())
            ON CONFLICT (tenant_id, module_key) DO UPDATE
            SET enabled = EXCLUDED.enabled, updated_at = now()
            """, tenantId, m, enabled);
      }
    } else {
      List<String> incMods = plan != null ? toStringList(plan.get("includedModules")) : List.of("INVENTORY", "POS", "CASH_REGISTER", "QUOTES", "CUSTOMERS", "REPORTS");
      for (String m : ALL_AVAILABLE_MODULES) {
        boolean enabled = incMods.contains(m);
        db.update("""
            INSERT INTO tenant_modules (tenant_id, module_key, enabled, updated_at)
            VALUES (?, ?, ?, now())
            ON CONFLICT (tenant_id, module_key) DO UPDATE
            SET enabled = EXCLUDED.enabled, updated_at = now()
            """, tenantId, m, enabled);
      }
    }

    return getTenantModules(tenantId);
  }

  public Map<String, Object> getTenantTrialInfo(UUID tenantId) {
    setTenantContext(tenantId);
    try {
      Map<String, Object> row = db.queryForMap("""
          SELECT t.id, t.name, t.plan, t.intended_plan, t.is_trial, t.subscription_status,
                 t.trial_ends_at, (t.trial_ends_at - CURRENT_DATE) as days_remaining,
                 t.monthly_fee, t.created_at
          FROM tenants t
          WHERE t.id = ?
          """, tenantId);
      Map<String, Object> res = new LinkedHashMap<>(row);
      res.put("daysRemaining", row.get("days_remaining") != null ? ((Number) row.get("days_remaining")).intValue() : 0);
      return res;
    } catch (EmptyResultDataAccessException e) {
      throw new IllegalArgumentException("Tienda no encontrada: " + tenantId);
    }
  }

  // --- HELPERS ---

  private List<Map<String, Object>> formatPlanRows(List<Map<String, Object>> rows) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (var r : rows) {
      result.add(formatPlanRow(r));
    }
    return result;
  }

  private Map<String, Object> formatPlanRow(Map<String, Object> row) {
    Map<String, Object> m = new LinkedHashMap<>(row);
    List<String> incMods = toList(row.get("included_modules"));
    List<String> feats = toList(row.get("features"));
    m.put("monthlyPrice", row.get("monthly_price"));
    m.put("included_modules", incMods);
    m.put("includedModules", incMods);
    m.put("features", feats);
    m.put("isPopular", Boolean.TRUE.equals(row.get("is_popular")));
    m.put("isActive", Boolean.TRUE.equals(row.get("is_active")));
    m.put("displayOrder", row.get("display_order"));
    return m;
  }

  @SuppressWarnings("unchecked")
  private List<String> toList(Object obj) {
    if (obj == null) return new ArrayList<>();
    if (obj instanceof Array sqlArray) {
      try {
        Object arr = sqlArray.getArray();
        if (arr instanceof String[] strArr) {
          return new ArrayList<>(Arrays.asList(strArr));
        } else if (arr instanceof Object[] objArr) {
          List<String> list = new ArrayList<>();
          for (Object o : objArr) list.add(String.valueOf(o));
          return list;
        }
      } catch (Exception ignored) {}
    } else if (obj instanceof List<?> l) {
      List<String> list = new ArrayList<>();
      for (Object o : l) list.add(String.valueOf(o));
      return list;
    } else if (obj instanceof String s) {
      String clean = s.replace("{", "").replace("}", "").trim();
      if (clean.isBlank()) return new ArrayList<>();
      return new ArrayList<>(Arrays.asList(clean.split(",")));
    }
    return new ArrayList<>();
  }

  @SuppressWarnings("unchecked")
  private List<String> toStringList(Object obj) {
    if (obj instanceof List<?> l) {
      List<String> res = new ArrayList<>();
      for (Object o : l) res.add(String.valueOf(o).trim());
      return res;
    }
    return toList(obj);
  }

  private String toSqlArray(List<String> list) {
    if (list == null || list.isEmpty()) return "{}";
    StringBuilder sb = new StringBuilder("{");
    for (int i = 0; i < list.size(); i++) {
      if (i > 0) sb.append(",");
      String item = list.get(i).replace("\"", "\\\"");
      sb.append("\"").append(item).append("\"");
    }
    sb.append("}");
    return sb.toString();
  }
}

