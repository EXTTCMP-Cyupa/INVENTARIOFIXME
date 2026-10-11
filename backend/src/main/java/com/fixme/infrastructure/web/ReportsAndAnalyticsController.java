package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportsAndAnalyticsController {
  private final JdbcTemplate db;

  public ReportsAndAnalyticsController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  private void context(UUID tenant) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
  }

  // ==========================================
  // 1. REPORTE DE COMISIONES DE TÉCNICOS
  // ==========================================

  @GetMapping("/technician-commissions")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> getTechnicianCommissions(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate,
      @RequestParam(required = false) UUID technicianId
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    String dateFilter = "";
    if (startDate != null && !startDate.isBlank()) {
      dateFilter += " AND wo.created_at >= '" + startDate + "'::date ";
    }
    if (endDate != null && !endDate.isBlank()) {
      dateFilter += " AND wo.created_at <= ('" + endDate + "'::date + interval '1 day') ";
    }
    if (technicianId != null) {
      dateFilter += " AND wo.assigned_technician_id = '" + technicianId + "' ";
    }

    String summarySql = """
        SELECT
          u.id AS technician_id,
          COALESCE(u.full_name, u.email) AS technician_name,
          u.email AS technician_email,
          COUNT(wo.id) AS total_orders,
          COUNT(wo.id) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')) AS completed_orders,
          COALESCE(SUM(wo.payment_amount) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')), 0) AS total_labor_revenue,
          COALESCE(SUM(wo.technician_commission_amount), 0) AS total_commission_amount
        FROM app_users u
        LEFT JOIN work_orders wo ON wo.assigned_technician_id = u.id AND wo.tenant_id = u.tenant_id """ + dateFilter + """
        WHERE u.tenant_id = ?
          AND u.role = 'TECHNICIAN'
        GROUP BY u.id, u.full_name, u.email
        ORDER BY total_labor_revenue DESC
        """;

    List<Map<String, Object>> technicians = db.queryForList(summarySql, tenant);

    String ordersSql = """
        SELECT
          wo.id, wo.order_number, wo.device_brand, wo.device_model, wo.status,
          wo.payment_amount, wo.technician_commission_percent, wo.technician_commission_amount,
          wo.delivered_at, wo.created_at,
          COALESCE(u.full_name, u.email) AS technician_name,
          c.name AS customer_name
        FROM work_orders wo
        JOIN app_users u ON u.id = wo.assigned_technician_id
        LEFT JOIN customers c ON c.id = wo.customer_id
        WHERE wo.tenant_id = ?
          AND wo.assigned_technician_id IS NOT NULL """ + dateFilter + """
        ORDER BY wo.created_at DESC
        LIMIT 200
        """;

    List<Map<String, Object>> orders = db.queryForList(ordersSql, tenant);

    return Map.of(
        "technicians", technicians,
        "orders", orders
    );
  }

  // ==========================================
  // 2. ESTADO DE RESULTADOS / UTILIDAD NETA REAL
  // ==========================================

  @GetMapping("/financial-pnl")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> getFinancialPnL(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    String salesDateFilter = "";
    String woDateFilter = "";
    String cashDateFilter = "";

    if (startDate != null && !startDate.isBlank()) {
      salesDateFilter += " AND s.created_at >= '" + startDate + "'::date ";
      woDateFilter += " AND wo.created_at >= '" + startDate + "'::date ";
      cashDateFilter += " AND cm.created_at >= '" + startDate + "'::date ";
    }
    if (endDate != null && !endDate.isBlank()) {
      salesDateFilter += " AND s.created_at <= ('" + endDate + "'::date + interval '1 day') ";
      woDateFilter += " AND wo.created_at <= ('" + endDate + "'::date + interval '1 day') ";
      cashDateFilter += " AND cm.created_at <= ('" + endDate + "'::date + interval '1 day') ";
    }

    // 1. Ingresos por ventas mostrador (POS)
    String posSql = """
        SELECT
          COALESCE(SUM(s.total), 0) AS pos_gross_sales,
          COALESCE(SUM(si.quantity * p.purchase_price), 0) AS pos_cogs
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE s.tenant_id = ? AND s.status != 'CANCELLED' """ + salesDateFilter;
    Map<String, Object> posData = db.queryForMap(posSql, tenant);

    // 2. Ingresos por Servicio Técnico (Mano de obra)
    String woSql = """
        SELECT
          COALESCE(SUM(wo.payment_amount) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')), 0) AS workshop_revenue,
          COALESCE(SUM(wo.technician_commission_amount), 0) AS technician_commissions
        FROM work_orders wo
        WHERE wo.tenant_id = ? """ + woDateFilter;
    Map<String, Object> woData = db.queryForMap(woSql, tenant);

    // 3. Gastos operativos registrados en caja (Egresos)
    String cashExpensesSql = """
        SELECT
          COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('CASH_OUT', 'OUT')), 0) AS operating_expenses
        FROM cash_movements cm
        WHERE cm.tenant_id = ? """ + cashDateFilter;
    Map<String, Object> cashData = db.queryForMap(cashExpensesSql, tenant);

    BigDecimal posSales = new BigDecimal(posData.get("pos_gross_sales").toString());
    BigDecimal posCogs = new BigDecimal(posData.get("pos_cogs").toString());
    BigDecimal workshopRev = new BigDecimal(woData.get("workshop_revenue").toString());
    BigDecimal techCommissions = new BigDecimal(woData.get("technician_commissions").toString());
    BigDecimal operatingExpenses = new BigDecimal(cashData.get("operating_expenses").toString());

    BigDecimal totalRevenue = posSales.add(workshopRev);
    BigDecimal grossProfit = totalRevenue.subtract(posCogs);
    BigDecimal netProfit = grossProfit.subtract(techCommissions).subtract(operatingExpenses);

    return Map.of(
        "totalRevenue", totalRevenue,
        "posGrossSales", posSales,
        "workshopRevenue", workshopRev,
        "posCogs", posCogs,
        "grossProfit", grossProfit,
        "technicianCommissions", techCommissions,
        "operatingExpenses", operatingExpenses,
        "netProfit", netProfit
    );
  }

  // ==========================================
  // 3. DASHBOARD ADMINISTRATIVO Y OPERATIVO (MES ACTUAL)
  // ==========================================

  @GetMapping("/dashboard-admin")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_ACCOUNTANT')")
  public Map<String, Object> getDashboardAdmin(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false, defaultValue = "month") String period,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    String sFilter;
    String woFilter;
    String cmFilter;
    String pFilter;

    if (startDate != null && !startDate.isBlank() && endDate != null && !endDate.isBlank()) {
      sFilter = " AND s.created_at >= '" + startDate + "'::date AND s.created_at <= ('" + endDate + "'::date + interval '1 day') ";
      woFilter = " AND wo.created_at >= '" + startDate + "'::date AND wo.created_at <= ('" + endDate + "'::date + interval '1 day') ";
      cmFilter = " AND cm.created_at >= '" + startDate + "'::date AND cm.created_at <= ('" + endDate + "'::date + interval '1 day') ";
      pFilter = " AND p.created_at >= '" + startDate + "'::date AND p.created_at <= ('" + endDate + "'::date + interval '1 day') ";
    } else if ("last30".equalsIgnoreCase(period)) {
      sFilter = " AND s.created_at >= (CURRENT_DATE - interval '30 days') ";
      woFilter = " AND wo.created_at >= (CURRENT_DATE - interval '30 days') ";
      cmFilter = " AND cm.created_at >= (CURRENT_DATE - interval '30 days') ";
      pFilter = " AND p.created_at >= (CURRENT_DATE - interval '30 days') ";
    } else if ("all".equalsIgnoreCase(period)) {
      sFilter = "";
      woFilter = "";
      cmFilter = "";
      pFilter = "";
    } else {
      // Default: Mes en curso ("month")
      sFilter = " AND s.created_at >= date_trunc('month', CURRENT_DATE) ";
      woFilter = " AND wo.created_at >= date_trunc('month', CURRENT_DATE) ";
      cmFilter = " AND cm.created_at >= date_trunc('month', CURRENT_DATE) ";
      pFilter = " AND p.created_at >= date_trunc('month', CURRENT_DATE) ";
    }

    // 1. Estado del Plan Contratado & Días Restantes
    Map<String, Object> tenantRow = db.queryForMap("""
        SELECT t.id, t.name, t.plan, t.intended_plan, t.is_trial, t.subscription_status,
               t.payment_status, t.billing_cycle, t.monthly_fee,
               t.trial_ends_at, t.next_billing_date,
               CASE 
                 WHEN t.is_trial THEN (t.trial_ends_at - CURRENT_DATE)
                 ELSE (t.next_billing_date - CURRENT_DATE)
               END as days_remaining
        FROM tenants t
        WHERE t.id = ?
        """, tenant);

    int daysRemaining = tenantRow.get("days_remaining") != null 
        ? ((Number) tenantRow.get("days_remaining")).intValue() 
        : 0;
    boolean isTrial = Boolean.TRUE.equals(tenantRow.get("is_trial"));
    boolean isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
    boolean isExpired = daysRemaining <= 0;

    Map<String, Object> subscription = new LinkedHashMap<>(tenantRow);
    subscription.put("daysRemaining", daysRemaining);
    subscription.put("isExpiringSoon", isExpiringSoon);
    subscription.put("isExpired", isExpired);

    // 2. Métricas Financieras del Período
    String salesMonthlySql = """
        SELECT
          COUNT(s.id) AS sales_count,
          COALESCE(SUM(s.total), 0) AS sales_revenue,
          COALESCE(SUM(si.quantity * COALESCE(si.cost_price, p.purchase_price, 0)), 0) AS sales_cogs
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE s.tenant_id = ? AND s.status != 'CANCELLED' """ + sFilter;
    Map<String, Object> salesData = db.queryForMap(salesMonthlySql, tenant);

    String woMonthlySql = """
        SELECT
          COUNT(wo.id) AS total_orders,
          COUNT(wo.id) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')) AS completed_orders,
          COALESCE(SUM(wo.payment_amount) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')), 0) AS workshop_revenue,
          COALESCE(SUM(wo.technician_commission_amount), 0) AS technician_commissions
        FROM work_orders wo
        WHERE wo.tenant_id = ? """ + woFilter;
    Map<String, Object> woData = db.queryForMap(woMonthlySql, tenant);

    String cashExpensesSql = """
        SELECT
          COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('CASH_OUT', 'OUT')), 0) AS operating_expenses
        FROM cash_movements cm
        WHERE cm.tenant_id = ? """ + cmFilter;
    Map<String, Object> cashData = db.queryForMap(cashExpensesSql, tenant);

    String purchasesSql = """
        SELECT
          COALESCE(SUM(p.total), 0) AS purchases_total
        FROM purchases p
        WHERE p.tenant_id = ? AND p.status != 'CANCELLED' """ + pFilter;
    Map<String, Object> purchasesData = db.queryForMap(purchasesSql, tenant);

    BigDecimal salesRevenue = new BigDecimal(salesData.get("sales_revenue").toString());
    BigDecimal salesCogs = new BigDecimal(salesData.get("sales_cogs").toString());
    long salesCount = ((Number) salesData.get("sales_count")).longValue();

    BigDecimal workshopRevenue = new BigDecimal(woData.get("workshop_revenue").toString());
    BigDecimal techCommissions = new BigDecimal(woData.get("technician_commissions").toString());
    long completedWorkshopOrders = ((Number) woData.get("completed_orders")).longValue();

    BigDecimal operatingExpenses = new BigDecimal(cashData.get("operating_expenses").toString());
    BigDecimal purchasesTotal = new BigDecimal(purchasesData.get("purchases_total").toString());

    BigDecimal totalRevenue = salesRevenue.add(workshopRevenue);
    BigDecimal totalCogs = salesCogs;
    BigDecimal grossProfit = totalRevenue.subtract(totalCogs);
    BigDecimal netProfit = grossProfit.subtract(operatingExpenses).subtract(techCommissions);
    BigDecimal netMarginPercent = totalRevenue.signum() > 0
        ? netProfit.multiply(BigDecimal.valueOf(100)).divide(totalRevenue, 2, java.math.RoundingMode.HALF_UP)
        : BigDecimal.ZERO;

    Map<String, Object> financials = new LinkedHashMap<>();
    financials.put("salesRevenue", salesRevenue);
    financials.put("salesCogs", salesCogs);
    financials.put("salesCount", salesCount);
    financials.put("workshopRevenue", workshopRevenue);
    financials.put("techCommissions", techCommissions);
    financials.put("completedWorkshopOrders", completedWorkshopOrders);
    financials.put("operatingExpenses", operatingExpenses);
    financials.put("purchasesTotal", purchasesTotal);
    financials.put("totalRevenue", totalRevenue);
    financials.put("grossProfit", grossProfit);
    financials.put("netProfit", netProfit);
    financials.put("netMarginPercent", netMarginPercent);

    // 3. Trabajos Realizados por Persona en el Período (Técnicos)
    String techPerformanceSql = """
        SELECT
          u.id AS technician_id,
          COALESCE(u.full_name, u.email) AS name,
          u.email,
          COUNT(wo.id) AS total_orders,
          COUNT(wo.id) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')) AS completed_orders,
          COUNT(wo.id) FILTER (WHERE wo.status NOT IN ('COMPLETED','DELIVERED','ENTREGADO','CANCELLED','REJECTED')) AS active_orders,
          COALESCE(SUM(wo.payment_amount) FILTER (WHERE wo.status IN ('COMPLETED','DELIVERED','ENTREGADO')), 0) AS labor_revenue,
          COALESCE(SUM(wo.technician_commission_amount), 0) AS commission_amount
        FROM app_users u
        LEFT JOIN work_orders wo ON wo.assigned_technician_id = u.id 
                                 AND wo.tenant_id = u.tenant_id """ + woFilter + """
        WHERE u.tenant_id = ?
          AND u.role = 'TECHNICIAN'
        GROUP BY u.id, u.full_name, u.email
        ORDER BY completed_orders DESC, labor_revenue DESC
        """;
    List<Map<String, Object>> technicians = db.queryForList(techPerformanceSql, tenant);

    // 4. Ventas Realizadas por Persona en el Período (Vendedores / Mostrador)
    String sellerPerformanceSql = """
        SELECT
          u.id AS user_id,
          COALESCE(u.full_name, u.email) AS name,
          u.email,
          u.role,
          COUNT(s.id) AS sales_count,
          COALESCE(SUM(s.total), 0) AS total_sold,
          CASE WHEN COUNT(s.id) > 0 THEN COALESCE(SUM(s.total), 0) / COUNT(s.id) ELSE 0 END AS avg_ticket
        FROM app_users u
        JOIN sales s ON s.user_id = u.id AND s.tenant_id = u.tenant_id
        WHERE u.tenant_id = ? AND s.status != 'CANCELLED' """ + sFilter + """
        GROUP BY u.id, u.full_name, u.email, u.role
        ORDER BY total_sold DESC
        """;
    List<Map<String, Object>> sellers = db.queryForList(sellerPerformanceSql, tenant);

    // 5. Categorías Más Vendidas del Período
    String topCategoriesSql = """
        SELECT
          COALESCE(c.name, 'General / Sin Categoría') AS category_name,
          COALESCE(SUM(si.quantity), 0) AS units_sold,
          COALESCE(SUM(si.line_total), 0) AS total_revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.tenant_id = ? AND s.status != 'CANCELLED' """ + sFilter + """
        GROUP BY c.name
        ORDER BY total_revenue DESC
        LIMIT 5
        """;
    List<Map<String, Object>> topCategories = db.queryForList(topCategoriesSql, tenant);

    // 6. Productos Más Vendidos del Período
    String topProductsSql = """
        SELECT
          p.id,
          p.name,
          p.sku,
          COALESCE(c.name, 'General') AS category_name,
          COALESCE(SUM(si.quantity), 0) AS units_sold,
          COALESCE(SUM(si.line_total), 0) AS total_revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.tenant_id = ? AND s.status != 'CANCELLED' """ + sFilter + """
        GROUP BY p.id, p.name, p.sku, c.name
        ORDER BY units_sold DESC
        LIMIT 5
        """;
    List<Map<String, Object>> topProducts = db.queryForList(topProductsSql, tenant);

    // 7. Inventario / Stock crítico
    String inventoryHealthSql = """
        SELECT
          COUNT(*) FILTER (WHERE ps.stock <= COALESCE(p.min_stock, 5)) AS low_stock_count,
          COUNT(*) FILTER (WHERE ps.stock = 0) AS out_of_stock_count
        FROM product_stock ps
        JOIN products p ON p.id = ps.product_id
        WHERE p.tenant_id = ?
        """;
    Map<String, Object> inventoryHealth = db.queryForMap(inventoryHealthSql, tenant);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("period", period);
    response.put("subscription", subscription);
    response.put("financials", financials);
    response.put("technicians", technicians);
    response.put("sellers", sellers);
    response.put("topCategories", topCategories);
    response.put("topProducts", topProducts);
    response.put("inventoryHealth", inventoryHealth);
    return response;
  }
}

