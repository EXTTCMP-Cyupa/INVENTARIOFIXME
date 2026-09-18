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
import com.fixme.application.WorkOrderService;
import com.fixme.domain.WorkOrder;

@RestController
public class BusinessModulesController {
  private final JdbcTemplate db;
  private final ModuleService modules;
  private final WorkOrderService workOrderService;

  public BusinessModulesController(JdbcTemplate db, ModuleService modules, WorkOrderService workOrderService) {
    this.db = db;
    this.modules = modules;
    this.workOrderService = workOrderService;
  }

  private UUID tenant(Jwt j) {
    try {
      return UUID.fromString(Objects.requireNonNull(j.getClaimAsString("tenant_id")));
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tenant inválido");
    }
  }

  private void ctx(UUID t) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
  }

  private UUID user(UUID t, String email) {
    ctx(t);
    return db.queryForObject("select id from app_users where tenant_id=? and lower(email)=lower(?)", UUID.class, t, email);
  }

  private UUID id(String s) {
    try {
      return UUID.fromString(s);
    } catch (Exception e) {
      throw new IllegalArgumentException("Identificador inválido: " + s);
    }
  }

  private void required(Map<String, Object> b, String... keys) {
    for (String k : keys) {
      if (b == null || b.get(k) == null || b.get(k).toString().isBlank()) {
        throw new IllegalArgumentException(k + " es obligatorio");
      }
    }
  }

  private List<WorkOrderService.OrderItemInput> parseItems(Object raw) {
    if (raw instanceof List<?> list) {
      List<WorkOrderService.OrderItemInput> result = new ArrayList<>();
      for (Object obj : list) {
        if (obj instanceof Map<?, ?> map) {
          String name = Objects.toString(map.get("name"), "");
          String type = Objects.toString(map.get("itemType"), "SERVICE");
          BigDecimal qty = decimal(map.get("quantity"));
          if (qty.compareTo(BigDecimal.ZERO) <= 0) qty = BigDecimal.ONE;
          BigDecimal price = decimal(map.get("unitPrice"));
          if (!name.isBlank()) {
            result.add(new WorkOrderService.OrderItemInput(type, name, qty, price));
          }
        }
      }
      return result;
    }
    return Collections.emptyList();
  }

  // --- CUSTOMERS CRM 360 ---
  @GetMapping("/api/customers/stats")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> customerStats(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    ctx(t);
    String sql = """
        SELECT
          COUNT(*) AS total_customers,
          COUNT(*) FILTER (WHERE tag IN ('VIP', 'FREQUENT')) AS vip_customers,
          COALESCE((SELECT SUM(total) FROM sales WHERE tenant_id = ? AND customer_id IS NOT NULL), 0) AS total_sales_volume,
          COALESCE((SELECT COUNT(DISTINCT customer_id) FROM work_orders WHERE tenant_id = ? AND status NOT IN ('COMPLETED','CANCELLED','REJECTED')), 0) AS active_repair_customers
        FROM customers
        WHERE tenant_id = ?
        """;
    Map<String, Object> r = db.queryForMap(sql, t, t, t);
    return Map.of(
        "totalCustomers", r.getOrDefault("total_customers", 0),
        "vipCustomers", r.getOrDefault("vip_customers", 0),
        "totalSalesVolume", r.getOrDefault("total_sales_volume", BigDecimal.ZERO),
        "activeRepairCustomers", r.getOrDefault("active_repair_customers", 0)
    );
  }

  @GetMapping("/api/customers")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> customers(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String tag
  ) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    ctx(t);

    StringBuilder sql = new StringBuilder("""
        SELECT
          c.id, c.tenant_id, c.name, c.email, c.phone, c.address, c.city,
          COALESCE(c.identification_type, 'CEDULA') AS identification_type,
          c.identification_number,
          c.notes,
          COALESCE(c.tag, 'REGULAR') AS tag,
          c.created_at,
          COALESCE(COUNT(DISTINCT s.id), 0) AS total_sales_count,
          COALESCE(SUM(s.total), 0) AS total_spent,
          MAX(s.created_at) AS last_purchase_at,
          COALESCE(COUNT(DISTINCT wo.id), 0) AS total_work_orders_count,
          COALESCE(COUNT(DISTINCT wo.id) FILTER (WHERE wo.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')), 0) AS active_work_orders_count,
          COALESCE(COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'ACTIVE'), 0) AS active_warranties_count
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.tenant_id = c.tenant_id
        LEFT JOIN work_orders wo ON wo.customer_id = c.id AND wo.tenant_id = c.tenant_id
        LEFT JOIN warranties w ON w.customer_id = c.id AND w.tenant_id = c.tenant_id
        WHERE c.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (search != null && !search.isBlank()) {
      String p = "%" + search.trim().toLowerCase() + "%";
      sql.append(" AND (LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(c.identification_number, '')) LIKE ? OR LOWER(COALESCE(c.phone, '')) LIKE ? OR LOWER(COALESCE(c.email, '')) LIKE ? OR LOWER(COALESCE(c.city, '')) LIKE ?)");
      params.add(p);
      params.add(p);
      params.add(p);
      params.add(p);
      params.add(p);
    }

    if (tag != null && !tag.isBlank() && !"ALL".equalsIgnoreCase(tag)) {
      if ("ACTIVE_WORK_ORDERS".equalsIgnoreCase(tag)) {
        sql.append(" GROUP BY c.id HAVING COUNT(DISTINCT wo.id) FILTER (WHERE wo.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')) > 0");
      } else if ("WITH_SALES".equalsIgnoreCase(tag)) {
        sql.append(" GROUP BY c.id HAVING COUNT(DISTINCT s.id) > 0");
      } else {
        sql.append(" AND c.tag = ? GROUP BY c.id");
        params.add(tag.toUpperCase());
      }
    } else {
      sql.append(" GROUP BY c.id");
    }

    sql.append(" ORDER BY c.created_at DESC");
    return db.queryForList(sql.toString(), params.toArray());
  }

  @GetMapping("/api/customers/{id}/history")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> customerHistory(@PathVariable String id, @AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    ctx(t);
    UUID custId = id(id);

    Map<String, Object> customer = db.queryForMap("""
        SELECT
          c.id, c.tenant_id, c.name, c.email, c.phone, c.address, c.city,
          COALESCE(c.identification_type, 'CEDULA') AS identification_type,
          c.identification_number, c.notes, COALESCE(c.tag, 'REGULAR') AS tag, c.created_at
        FROM customers c
        WHERE c.id = ? AND c.tenant_id = ?
        """, custId, t);

    List<Map<String, Object>> sales = db.queryForList("""
        SELECT id, subtotal, tax, total, status, COALESCE(fulfillment_type, 'STORE') AS fulfillment_type, created_at
        FROM sales
        WHERE customer_id = ? AND tenant_id = ?
        ORDER BY created_at DESC LIMIT 20
        """, custId, t);

    List<Map<String, Object>> workOrders = db.queryForList("""
        SELECT id, order_number, device_brand, device_model, serial_number, description, diagnosis, quote, status, created_at
        FROM work_orders
        WHERE customer_id = ? AND tenant_id = ?
        ORDER BY created_at DESC LIMIT 20
        """, custId, t);

    List<Map<String, Object>> warranties = db.queryForList("""
        SELECT
          w.id,
          COALESCE(w.warranty_code, 'GAR-' || UPPER(SUBSTRING(w.id::text, 1, 6))) AS warranty_code,
          w.serial_number, w.status, w.starts_at, w.expires_at, w.terms,
          p.name AS product_name, p.sku AS product_sku,
          GREATEST(0, EXTRACT(DAY FROM (w.expires_at - now()))::int) AS remaining_days
        FROM warranties w
        LEFT JOIN products p ON p.id = w.product_id
        WHERE w.customer_id = ? AND w.tenant_id = ?
        ORDER BY w.created_at DESC LIMIT 20
        """, custId, t);

    List<Map<String, Object>> deliveries = db.queryForList("""
        SELECT id, status, courier, address, recipient_name, recipient_phone, tracking_number, created_at
        FROM deliveries
        WHERE customer_id = ? AND tenant_id = ?
        ORDER BY created_at DESC LIMIT 10
        """, custId, t);

    return Map.of(
        "customer", customer,
        "sales", sales,
        "workOrders", workOrders,
        "warranties", warranties,
        "deliveries", deliveries
    );
  }

  @PostMapping("/api/customers")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> createCustomer(@AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    required(b, "name");
    ctx(t);
    UUID id = UUID.randomUUID();
    String email = (b.get("email") != null && !b.get("email").toString().isBlank()) ? b.get("email").toString().trim() : null;
    String idType = (b.get("identificationType") != null && !b.get("identificationType").toString().isBlank()) ? b.get("identificationType").toString().trim().toUpperCase() : "CEDULA";
    String idNum = (b.get("identificationNumber") != null && !b.get("identificationNumber").toString().isBlank()) ? b.get("identificationNumber").toString().trim() : null;
    String tag = (b.get("tag") != null && !b.get("tag").toString().isBlank()) ? b.get("tag").toString().trim().toUpperCase() : "REGULAR";
    String notes = (String) b.get("notes");

    db.update("""
        INSERT INTO customers(id, tenant_id, name, email, phone, address, city, identification_type, identification_number, notes, tag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        id, t, b.get("name"), email, b.get("phone"), b.get("address"), b.get("city"), idType, idNum, notes, tag);

    return ResponseEntity.status(201).body(db.queryForMap("SELECT * FROM customers WHERE id=?", id));
  }

  @PutMapping("/api/customers/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateCustomer(@PathVariable String id, @AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    required(b, "name");
    ctx(t);
    String email = (b.get("email") != null && !b.get("email").toString().isBlank()) ? b.get("email").toString().trim() : null;
    String idType = (b.get("identificationType") != null && !b.get("identificationType").toString().isBlank()) ? b.get("identificationType").toString().trim().toUpperCase() : "CEDULA";
    String idNum = (b.get("identificationNumber") != null && !b.get("identificationNumber").toString().isBlank()) ? b.get("identificationNumber").toString().trim() : null;
    String tag = (b.get("tag") != null && !b.get("tag").toString().isBlank()) ? b.get("tag").toString().trim().toUpperCase() : "REGULAR";
    String notes = (String) b.get("notes");

    db.update("""
        UPDATE customers
        SET name = ?, email = ?, phone = ?, address = ?, city = ?,
            identification_type = ?, identification_number = ?, notes = ?, tag = ?
        WHERE id = ? AND tenant_id = ?
        """,
        b.get("name"), email, b.get("phone"), b.get("address"), b.get("city"),
        idType, idNum, notes, tag, id(id), t);

    return db.queryForMap("SELECT * FROM customers WHERE id=?", id(id));
  }

  @DeleteMapping("/api/customers/{id}")
  @PreAuthorize("hasAuthority('SCOPE_TENANT_ADMIN')")
  public ResponseEntity<Void> deleteCustomer(@PathVariable String id, @AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    modules.require(t, "CUSTOMERS");
    ctx(t);
    db.update("delete from customers where id=? and tenant_id=?", id(id), t);
    return ResponseEntity.noContent().build();
  }

  // --- DELIVERY DRIVERS ---
  @GetMapping("/api/delivery-drivers")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> deliveryDrivers(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    return db.queryForList("SELECT id, tenant_id, name, name AS \"fullName\", phone, vehicle_type AS \"vehicleType\", vehicle_type, external_company, active, notes, created_at FROM delivery_drivers WHERE tenant_id=? ORDER BY active DESC, name ASC", t);
  }

  @PostMapping("/api/delivery-drivers")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> createDeliveryDriver(@AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    Object nameVal = b.get("name") != null ? b.get("name") : b.get("fullName");
    if (nameVal == null || String.valueOf(nameVal).isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre del repartidor es requerido");
    }
    ctx(t);
    UUID id = UUID.randomUUID();
    Object vehicleVal = b.get("vehicle_type") != null ? b.get("vehicle_type") : b.getOrDefault("vehicleType", "MOTO");
    db.update(
        "INSERT INTO delivery_drivers(id, tenant_id, name, phone, vehicle_type, external_company, notes) VALUES(?,?,?,?,?,?,?)",
        id, t, nameVal, b.get("phone"), vehicleVal, b.get("external_company"), b.get("notes")
    );
    return ResponseEntity.status(201).body(db.queryForMap("SELECT id, tenant_id, name, name AS \"fullName\", phone, vehicle_type AS \"vehicleType\", vehicle_type, external_company, active, notes, created_at FROM delivery_drivers WHERE id=?", id));
  }

  @PatchMapping("/api/delivery-drivers/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateDeliveryDriver(@PathVariable String id, @AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    ctx(t);
    db.update(
        "UPDATE delivery_drivers SET name=COALESCE(?,name), phone=COALESCE(?,phone), vehicle_type=COALESCE(?,vehicle_type), external_company=COALESCE(?,external_company), active=COALESCE(?,active), notes=COALESCE(?,notes), updated_at=now() WHERE id=? AND tenant_id=?",
        b.get("name"), b.get("phone"), b.get("vehicle_type"), b.get("external_company"), b.get("active"), b.get("notes"), id(id), t
    );
    return db.queryForMap("SELECT * FROM delivery_drivers WHERE id=?", id(id));
  }

  // --- DELIVERIES ---
  @GetMapping("/api/deliveries")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> deliveries(@AuthenticationPrincipal Jwt j, @RequestParam(required = false) String status) {
    UUID t = tenant(j);
    modules.require(t, "DELIVERIES");
    ctx(t);
    String sql = """
        SELECT d.id, d.tenant_id, d.sale_id, d.customer_id, d.branch_id, d.status,
               d.courier, d.address, d.recipient_name, d.recipient_phone, d.delivery_notes,
               d.shipping_cost, d.tracking_number, d.tracking_url, d.driver_id, d.created_at, d.updated_at,
               s.total AS sale_total, s.channel AS sale_channel,
               c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               drv.name AS driver_name, drv.phone AS driver_phone, drv.vehicle_type AS driver_vehicle, drv.external_company AS driver_company
        FROM deliveries d
        LEFT JOIN sales s ON s.id = d.sale_id
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN delivery_drivers drv ON drv.id = d.driver_id
        WHERE d.tenant_id = ?
        """ + (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status) ? " AND d.status = ? " : "") + """
        ORDER BY d.created_at DESC
        """;
    return (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
        ? db.queryForList(sql, t, status)
        : db.queryForList(sql, t);
  }

  @PostMapping("/api/deliveries")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_SELLER','SCOPE_DELIVERY','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<Map<String, Object>> createDelivery(@AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    modules.require(t, "DELIVERIES");
    required(b, "address");
    ctx(t);
    UUID x = UUID.randomUUID();
    db.update("insert into deliveries(id,tenant_id,sale_id,customer_id,branch_id,address,courier,latitude,longitude,evidence_url,evidence_metadata,tracking_number,tracking_url,driver_id) values(?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?)",
        x, t, uuidOrNull(b.get("saleId")), uuidOrNull(b.get("customerId")), uuidOrNull(b.get("branchId")),
        b.get("address"), b.get("courier"), b.get("latitude"), b.get("longitude"), b.get("evidenceUrl"),
        b.getOrDefault("evidenceMetadata", "{}"), b.get("trackingNumber"), b.get("trackingUrl"), uuidOrNull(b.get("driverId")));
    return ResponseEntity.status(201).body(db.queryForMap("select * from deliveries where id=?", x));
  }

  @PatchMapping("/api/deliveries/{id}/status")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_DELIVERY','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> deliveryStatus(@PathVariable String id, @AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    modules.require(t, "DELIVERIES");
    required(b, "status");
    ctx(t);
    db.update("update deliveries set status=?,courier=coalesce(?,courier),tracking_number=coalesce(?,tracking_number),tracking_url=coalesce(?,tracking_url),driver_id=coalesce(?,driver_id),updated_at=now() where id=? and tenant_id=?",
        b.get("status"), b.get("courier"), b.get("trackingNumber"), b.get("trackingUrl"), uuidOrNull(b.get("driverId")), id(id), t);
    return db.queryForMap("select * from deliveries where id=?", id(id));
  }

  // --- WORK ORDERS (Hexagonal Service Driven with Items & Technicians) ---
  @GetMapping("/api/work-orders/technicians")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> technicians(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    ctx(t);
    return db.queryForList("""
        SELECT id, email, full_name, full_name AS "fullName", phone, role
        FROM app_users
        WHERE tenant_id = ? AND role IN ('TECHNICIAN', 'MANAGER', 'SELLER', 'TENANT_ADMIN')
        ORDER BY (role = 'TECHNICIAN') DESC, full_name ASC
        """, t);
  }

  @GetMapping("/api/work-orders")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> orders(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) UUID technicianId
  ) {
    UUID t = tenant(j);
    return workOrderService.listOrders(t, status, search, technicianId);
  }

  @GetMapping("/api/work-orders/my-work")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> myWorkOrders(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search
  ) {
    UUID t = tenant(j);
    UUID u = user(t, j.getSubject());
    return workOrderService.listOrders(t, status, search, u);
  }

  @GetMapping("/api/work-orders/my-work/stats")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> myWorkStats(@AuthenticationPrincipal Jwt j) {
    UUID t = tenant(j);
    UUID u = user(t, j.getSubject());
    ctx(t);
    String sql = """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('RECIBIDO','EN_DIAGNOSTICO','EN_REPARACION','ESPERANDO_REPUESTOS','OPEN','DIAGNOSIS','QUOTED','APPROVED','IN_PROGRESS','WAITING_PARTS')) AS active,
          COUNT(*) FILTER (WHERE status IN ('EN_REPARACION','IN_PROGRESS')) AS in_repair,
          COUNT(*) FILTER (WHERE status IN ('ESPERANDO_REPUESTOS','WAITING_PARTS')) AS waiting_parts,
          COUNT(*) FILTER (WHERE status IN ('LISTO_ENTREGA','COMPLETED')) AS ready,
          COUNT(*) FILTER (WHERE status IN ('ENTREGADO','DELIVERED')) AS completed,
          COUNT(*) FILTER (WHERE status IN ('RECIBIDO','EN_DIAGNOSTICO','EN_REPARACION','ESPERANDO_REPUESTOS','OPEN','DIAGNOSIS','QUOTED','APPROVED','IN_PROGRESS','WAITING_PARTS')
                           AND estimated_delivery IS NOT NULL AND estimated_delivery <= now() + interval '12 hours') AS urgent_sla
        FROM work_orders
        WHERE tenant_id = ? AND assigned_technician_id = ?
        """;
    return db.queryForMap(sql, t, u);
  }

  @PostMapping("/api/work-orders")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public ResponseEntity<WorkOrder> createOrder(@AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    required(b, "customerId");

    OffsetDateTime estDelivery = null;
    if (b.get("estimatedDelivery") != null && !b.get("estimatedDelivery").toString().isBlank()) {
      try {
        estDelivery = OffsetDateTime.parse(b.get("estimatedDelivery").toString());
      } catch (Exception ignored) {}
    }

    List<WorkOrderService.OrderItemInput> items = parseItems(b.get("items"));
    UUID techId = uuidOrNull(b.get("assignedTechnicianId"));
    Integer sla = b.get("slaHours") != null ? Integer.parseInt(b.get("slaHours").toString()) : 48;

    WorkOrderService.CreateOrderCommand cmd = new WorkOrderService.CreateOrderCommand(
        id(b.get("customerId").toString()),
        uuidOrNull(b.get("branchId")),
        (String) b.get("deviceBrand"),
        (String) b.get("deviceModel"),
        (String) b.get("serialNumber"),
        (String) b.get("reportedFault"),
        (String) b.get("accessories"),
        (String) b.get("description"),
        (String) b.get("diagnosis"),
        decimal(b.get("quote")),
        estDelivery,
        techId,
        sla,
        items
    );

    WorkOrder created = workOrderService.createOrder(t, cmd);
    return ResponseEntity.status(201).body(created);
  }

  @PatchMapping("/api/work-orders/{id}/status")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public WorkOrder orderStatus(@PathVariable String id, @AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    required(b, "status");
    return workOrderService.updateStatus(t, id(id), (String) b.get("status"), (String) b.get("technicianNotes"));
  }

  @PutMapping("/api/work-orders/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_TECHNICIAN','SCOPE_SUPER_ADMIN')")
  public WorkOrder updateTechnicalDetails(@PathVariable String id, @AuthenticationPrincipal Jwt j, @RequestBody Map<String, Object> b) {
    UUID t = tenant(j);
    OffsetDateTime estDelivery = null;
    if (b.get("estimatedDelivery") != null && !b.get("estimatedDelivery").toString().isBlank()) {
      try {
        estDelivery = OffsetDateTime.parse(b.get("estimatedDelivery").toString());
      } catch (Exception ignored) {}
    }

    List<WorkOrderService.OrderItemInput> items = b.containsKey("items") ? parseItems(b.get("items")) : null;
    UUID techId = uuidOrNull(b.get("assignedTechnicianId"));
    Integer sla = b.get("slaHours") != null ? Integer.parseInt(b.get("slaHours").toString()) : null;

    return workOrderService.updateTechnicalDetails(
        t, id(id),
        (String) b.get("diagnosis"),
        decimal(b.get("quote")),
        (String) b.get("technicianNotes"),
        estDelivery,
        techId,
        sla,
        items
    );
  }

  // --- PUBLIC CLIENT TRACKING & QUOTE APPROVAL PORTAL ---

  @GetMapping("/api/public/work-orders/tracking")
  public ResponseEntity<Map<String, Object>> publicTrackingApi(@RequestParam String token) {
    return ResponseEntity.ok(workOrderService.getPublicTracking(token));
  }

  @GetMapping(value = {"/api/public/work-orders/approve", "/public/work-orders/approve", "/api/auth/work-orders/approve"}, produces = MediaType.TEXT_HTML_VALUE)
  public ResponseEntity<String> publicOrderPortal(@RequestParam String token) {
    Map<String, Object> r;
    try {
      r = workOrderService.getPublicTracking(token);
    } catch (Exception e) {
      e.printStackTrace();
      return ResponseEntity.status(HttpStatus.GONE).body(errorPortalHtml("Orden no encontrada o enlace expirado: " + e.getMessage()));
    }

    String status = String.valueOf(r.get("status"));
    String storeName = r.get("store_name") != null ? html(r.get("store_name").toString()) : "FixmeTiendas";
    String branchName = r.get("branch_name") != null ? html(r.get("branch_name").toString()) : "Taller y Servicio Técnico";
    String orderNumber = r.get("order_number") != null ? html(r.get("order_number").toString()) : "OT-SERIE";
    String customer = r.get("customer_name") != null ? html(r.get("customer_name").toString()) : "Cliente";
    String phone = r.get("customer_phone") != null ? html(r.get("customer_phone").toString()) : "";
    String deviceBrand = r.get("device_brand") != null ? html(r.get("device_brand").toString()) : "";
    String deviceModel = r.get("device_model") != null ? html(r.get("device_model").toString()) : "";
    String serial = r.get("serial_number") != null ? html(r.get("serial_number").toString()) : "";
    String reportedFault = r.get("reported_fault") != null ? html(r.get("reported_fault").toString()) : (r.get("description") != null ? html(r.get("description").toString()) : "");
    String accessories = r.get("accessories") != null ? html(r.get("accessories").toString()) : "Ninguno";
    String diagnosis = html(String.valueOf(r.get("diagnosis") == null || r.get("diagnosis").toString().isBlank() ? "Diagnóstico en proceso por el técnico" : r.get("diagnosis")));
    BigDecimal quoteVal = r.get("quote") instanceof BigDecimal bd ? bd : new BigDecimal(String.valueOf(r.getOrDefault("quote", "0")));
    String quoteFormatted = String.format(Locale.US, "%.2f", quoteVal);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) r.getOrDefault("items", Collections.emptyList());

    OffsetDateTime expiry = r.get("approval_expires_at") instanceof OffsetDateTime odt ? odt : null;
    boolean canApprove = (expiry == null || expiry.isAfter(OffsetDateTime.now()))
        && Set.of("OPEN", "DIAGNOSIS", "QUOTED").contains(status)
        && quoteVal.compareTo(BigDecimal.ZERO) > 0;

    int step = switch (status) {
      case "OPEN" -> 1;
      case "DIAGNOSIS" -> 2;
      case "QUOTED" -> 3;
      case "APPROVED", "IN_PROGRESS" -> 4;
      case "COMPLETED" -> 5;
      default -> 1;
    };

    String statusTitle = switch (status) {
      case "OPEN" -> "Equipo Recibido";
      case "DIAGNOSIS" -> "En Diagnóstico Técnico";
      case "QUOTED" -> "Presupuesto Listo";
      case "APPROVED" -> "Presupuesto Aprobado";
      case "IN_PROGRESS" -> "Reparación en Curso";
      case "COMPLETED" -> "¡Listo para Retirar!";
      case "REJECTED" -> "Presupuesto Rechazado";
      case "CANCELLED" -> "Orden Cancelada";
      default -> status;
    };

    String htmlPage = buildClientPortalHtml(
        token, storeName, branchName, orderNumber, customer, phone,
        deviceBrand, deviceModel, serial, reportedFault, accessories,
        diagnosis, quoteFormatted, status, statusTitle, step, canApprove, items
    );

    return ResponseEntity.ok(htmlPage);
  }

  @PostMapping({"/api/public/work-orders/approve", "/public/work-orders/approve", "/api/auth/work-orders/approve"})
  public ResponseEntity<?> processApproval(
      @RequestParam(required = false) String token,
      @RequestParam(required = false) Boolean accepted,
      @RequestParam(required = false) String comments,
      @RequestBody(required = false) Map<String, Object> body,
      @RequestHeader(value = "Accept", defaultValue = "") String acceptHeader
  ) {
    String finalToken = token != null ? token : (body != null ? (String) body.get("token") : null);
    boolean finalAccepted = accepted != null ? accepted : (body != null && Boolean.TRUE.equals(body.get("accepted")));
    String finalComments = comments != null ? comments : (body != null ? (String) body.get("comments") : null);

    if (finalToken == null || finalToken.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token de orden requerido");
    }

    Map<String, Object> result;
    try {
      result = workOrderService.respondToQuote(finalToken, finalAccepted, finalComments);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    if (acceptHeader.contains("text/html")) {
      return ResponseEntity.status(HttpStatus.SEE_OTHER)
          .header("Location", "/public/work-orders/approve?token=" + finalToken)
          .build();
    }

    return ResponseEntity.ok(result);
  }

  // --- HTML CLIENT PORTAL GENERATOR ---
  private String buildClientPortalHtml(
      String token, String storeName, String branchName, String orderNumber,
      String customer, String phone, String brand, String model, String serial,
      String reportedFault, String accessories, String diagnosis, String quote,
      String status, String statusTitle, int step, boolean canApprove,
      List<Map<String, Object>> items
  ) {
    String deviceText = (brand + " " + model).trim();
    if (deviceText.isBlank()) deviceText = "Dispositivo / Equipo";

    StringBuilder itemsRowsHtml = new StringBuilder();
    if (items != null && !items.isEmpty()) {
      for (Map<String, Object> it : items) {
        String itType = String.valueOf(it.getOrDefault("itemType", "SERVICE"));
        String typeBadge = "LABOR".equalsIgnoreCase(itType)
            ? "<span class='badge-labor'>Mano de obra</span>"
            : "<span class='badge-part'>Repuesto</span>";
        String itName = html(String.valueOf(it.getOrDefault("name", "")));
        String itQty = String.valueOf(it.getOrDefault("quantity", "1"));
        BigDecimal price = decimal(it.get("unitPrice"));
        BigDecimal sub = decimal(it.get("subtotal"));

        itemsRowsHtml.append("""
            <tr>
              <td>%s <strong>%s</strong></td>
              <td style="text-align:center;">%s</td>
              <td style="text-align:right;">$%s</td>
              <td style="text-align:right; font-weight:700;">$%s</td>
            </tr>
            """.formatted(typeBadge, itName, itQty, String.format(Locale.US, "%.2f", price), String.format(Locale.US, "%.2f", sub)));
      }
    }

    String itemsTableSection = itemsRowsHtml.length() > 0 ? """
        <div style="margin-top: 14px;">
          <small style="color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em;">Desglose del Presupuesto</small>
          <table class="items-table">
            <thead>
              <tr>
                <th>Concepto / Repuesto</th>
                <th style="text-align:center;">Cant.</th>
                <th style="text-align:right;">Precio</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              %s
            </tbody>
          </table>
        </div>
        """.formatted(itemsRowsHtml.toString()) : "";

    String actionHtml;
    if (canApprove) {
      actionHtml = """
          <div class="card action-card" id="approval-box">
            <h3>Autorización de Presupuesto</h3>
            <p class="muted">Revisa el monto de la reparación y confírmanos tu autorización para iniciar el trabajo técnico.</p>
            <div class="action-buttons">
              <button class="btn btn-approve" onclick="submitDecision(true)">✓ Aprobar Presupuesto</button>
              <button class="btn btn-reject" onclick="submitDecision(false)">✕ Rechazar</button>
            </div>
            <div id="feedback-msg" class="feedback-msg" style="display:none;"></div>
          </div>
          """;
    } else if ("APPROVED".equals(status) || "IN_PROGRESS".equals(status)) {
      actionHtml = """
          <div class="card success-banner">
            <div class="banner-icon">✓</div>
            <div>
              <strong>¡Presupuesto Aprobado!</strong>
              <p>Tu equipo se encuentra en el taller en proceso de reparación. Te notificaremos en cuanto esté listo.</p>
            </div>
          </div>
          """;
    } else if ("COMPLETED".equals(status)) {
      actionHtml = """
          <div class="card pickup-banner">
            <div class="banner-icon">🎉</div>
            <div>
              <strong>¡Tu equipo está listo para retiro!</strong>
              <p>La reparación ha finalizado con éxito. Puedes pasar a retirar tu equipo en nuestra sucursal.</p>
            </div>
          </div>
          """;
    } else if ("REJECTED".equals(status)) {
      actionHtml = """
          <div class="card reject-banner">
            <div class="banner-icon">✕</div>
            <div>
              <strong>Presupuesto Rechazado</strong>
              <p>Has decidido no proceder con la reparación. Puedes coordinar con la tienda el retiro de tu equipo.</p>
            </div>
          </div>
          """;
    } else {
      actionHtml = """
          <div class="card info-banner">
            <div class="banner-icon">⏳</div>
            <div>
              <strong>Diagnóstico en proceso</strong>
              <p>El equipo técnico está revisando tu equipo. En breve publicaremos el diagnóstico y la cotización aquí.</p>
            </div>
          </div>
          """;
    }

    return """
        <!doctype html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>%s · Seguimiento de Orden %s</title>
          <style>
            :root {
              --primary: #3157d5;
              --primary-dark: #223fa8;
              --success: #10b981;
              --danger: #ef4444;
              --text: #0f172a;
              --muted: #64748b;
              --bg: #f8fafc;
              --card: #ffffff;
              --border: #e2e8f0;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background: var(--bg);
              color: var(--text);
              padding: 20px 14px 60px;
              display: flex;
              justify-content: center;
            }
            .container { width: 100%%; max-width: 580px; }
            .header-nav {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .brand-badge {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .brand-logo {
              width: 36px;
              height: 36px;
              border-radius: 10px;
              background: var(--primary);
              color: #fff;
              display: grid;
              place-items: center;
              font-weight: 800;
              font-size: 16px;
            }
            .brand-info h1 { font-size: 17px; font-weight: 800; color: var(--text); }
            .brand-info p { font-size: 12px; color: var(--muted); }
            .order-folio {
              background: #edf2f7;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
              color: var(--text);
            }
            .card {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 16px;
              padding: 22px;
              margin-bottom: 16px;
              box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
            }
            .status-hero {
              text-align: center;
              padding: 24px 18px;
            }
            .status-badge {
              display: inline-block;
              padding: 5px 14px;
              border-radius: 30px;
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 10px;
              letter-spacing: .04em;
              text-transform: uppercase;
            }
            .status-badge.status-open, .status-badge.status-diagnosis { background: #fef3c7; color: #92400e; }
            .status-badge.status-quoted { background: #e0e7ff; color: #3730a3; }
            .status-badge.status-approved, .status-badge.status-in_progress { background: #dcfce7; color: #166534; }
            .status-badge.status-completed { background: #ecfdf5; color: #065f46; }
            .status-badge.status-rejected, .status-badge.status-cancelled { background: #fee2e2; color: #991b1b; }
            .status-hero h2 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
            .status-hero p { font-size: 13px; color: var(--muted); }

            /* Stepper */
            .stepper {
              display: flex;
              justify-content: space-between;
              margin: 20px 0 6px;
              position: relative;
            }
            .stepper::before {
              content: '';
              position: absolute;
              top: 14px;
              left: 20px;
              right: 20px;
              height: 3px;
              background: #e2e8f0;
              z-index: 1;
            }
            .step-item {
              position: relative;
              z-index: 2;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-size: 10px;
              font-weight: 600;
              color: var(--muted);
              gap: 6px;
              width: 58px;
              text-align: center;
            }
            .step-dot {
              width: 30px;
              height: 30px;
              border-radius: 50%%;
              background: #fff;
              border: 3px solid #e2e8f0;
              display: grid;
              place-items: center;
              font-size: 11px;
              font-weight: 700;
              color: var(--muted);
            }
            .step-item.active .step-dot {
              border-color: var(--primary);
              background: var(--primary);
              color: #fff;
            }
            .step-item.active { color: var(--primary); font-weight: 700; }
            .step-item.done .step-dot {
              border-color: var(--success);
              background: var(--success);
              color: #fff;
            }

            .section-title {
              font-size: 14px;
              font-weight: 700;
              color: var(--text);
              margin-bottom: 14px;
              text-transform: uppercase;
              letter-spacing: .06em;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .detail-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .detail-cell small { display: block; font-size: 11px; color: var(--muted); margin-bottom: 2px; }
            .detail-cell strong { font-size: 14px; color: var(--text); }
            .full-row { grid-column: span 2; }

            .quote-box {
              background: #f1f5f9;
              border-radius: 12px;
              padding: 18px;
              margin-top: 14px;
            }
            .quote-amount {
              font-size: 32px;
              font-weight: 800;
              color: var(--primary);
              margin: 4px 0 8px;
            }
            .warranty-tag {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: #065f46;
              background: #d1fae5;
              padding: 4px 10px;
              border-radius: 8px;
              font-weight: 600;
            }

            /* Items Table */
            .items-table {
              width: 100%%;
              border-collapse: collapse;
              margin: 10px 0 16px;
              font-size: 13px;
              background: #fff;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid var(--border);
            }
            .items-table th {
              text-align: left;
              padding: 9px 10px;
              background: #f8fafc;
              border-bottom: 1px solid var(--border);
              font-size: 11px;
              text-transform: uppercase;
              color: var(--muted);
              letter-spacing: .05em;
            }
            .items-table td {
              padding: 10px;
              border-bottom: 1px solid #f1f5f9;
              color: var(--text);
            }
            .badge-labor {
              display: inline-block;
              background: #e0e7ff;
              color: #3730a3;
              padding: 2px 7px;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 700;
              margin-right: 4px;
            }
            .badge-part {
              display: inline-block;
              background: #fef3c7;
              color: #92400e;
              padding: 2px 7px;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 700;
              margin-right: 4px;
            }

            /* Action Buttons */
            .action-card { text-align: center; }
            .action-card h3 { font-size: 18px; margin-bottom: 6px; }
            .action-buttons {
              display: flex;
              gap: 12px;
              margin-top: 20px;
            }
            .btn {
              flex: 1;
              padding: 14px;
              border-radius: 12px;
              border: 0;
              font-size: 14px;
              font-weight: 700;
              cursor: pointer;
              transition: transform .15s, opacity .15s;
            }
            .btn:active { transform: scale(0.98); }
            .btn-approve { background: var(--primary); color: #fff; box-shadow: 0 4px 14px rgba(49, 87, 213, 0.25); }
            .btn-reject { background: #fff1f2; color: var(--danger); border: 1px solid #ffe4e6; }
            .feedback-msg {
              margin-top: 15px;
              padding: 12px;
              border-radius: 10px;
              font-size: 13px;
              font-weight: 600;
            }

            .success-banner, .pickup-banner, .reject-banner, .info-banner {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .banner-icon {
              width: 44px;
              height: 44px;
              border-radius: 12px;
              display: grid;
              place-items: center;
              font-size: 20px;
              font-weight: 800;
              flex-shrink: 0;
            }
            .success-banner .banner-icon { background: #dcfce7; color: #166534; }
            .pickup-banner .banner-icon { background: #ecfdf5; color: #065f46; }
            .reject-banner .banner-icon { background: #fee2e2; color: #991b1b; }
            .info-banner .banner-icon { background: #f1f5f9; color: var(--primary); }

            .support-footer {
              text-align: center;
              margin-top: 24px;
            }
            .support-footer p { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
            .whatsapp-btn {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #25d366;
              color: #fff;
              text-decoration: none;
              font-size: 13px;
              font-weight: 700;
              padding: 10px 18px;
              border-radius: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <header class="header-nav">
              <div class="brand-badge">
                <div class="brand-logo">FX</div>
                <div class="brand-info">
                  <h1>%s</h1>
                  <p>%s</p>
                </div>
              </div>
              <div class="order-folio">Orden %s</div>
            </header>

            <section class="card status-hero">
              <span class="status-badge status-%s">%s</span>
              <h2>%s</h2>
              <p>Seguimiento de servicio técnico en tiempo real</p>

              <div class="stepper">
                <div class="step-item %s">
                  <div class="step-dot">1</div>
                  <span>Recibido</span>
                </div>
                <div class="step-item %s">
                  <div class="step-dot">2</div>
                  <span>Diagnóstico</span>
                </div>
                <div class="step-item %s">
                  <div class="step-dot">3</div>
                  <span>Cotizado</span>
                </div>
                <div class="step-item %s">
                  <div class="step-dot">4</div>
                  <span>Taller</span>
                </div>
                <div class="step-item %s">
                  <div class="step-dot">5</div>
                  <span>Listo</span>
                </div>
              </div>
            </section>

            %s

            <section class="card">
              <h3 class="section-title">📦 Ficha del Dispositivo</h3>
              <div class="detail-grid">
                <div class="detail-cell">
                  <small>Dispositivo</small>
                  <strong>%s</strong>
                </div>
                <div class="detail-cell">
                  <small>Serie / IMEI</small>
                  <strong>%s</strong>
                </div>
                <div class="detail-cell full-row">
                  <small>Falla reportada por el cliente</small>
                  <strong>%s</strong>
                </div>
                <div class="detail-cell full-row">
                  <small>Accesorios recibidos</small>
                  <strong>%s</strong>
                </div>
              </div>
            </section>

            <section class="card">
              <h3 class="section-title">🔍 Diagnóstico y Cotización</h3>
              <div class="detail-cell">
                <small>Informe técnico</small>
                <p style="margin-top:4px; font-size:14px; line-height:1.5;">%s</p>
              </div>

              %s

              <div class="quote-box">
                <small style="color:var(--muted); font-size:12px; font-weight:600;">Total de la Reparación</small>
                <div class="quote-amount">$%s</div>
                <div class="warranty-tag">🛡️ Incluye 90 días de garantía en repuestos y mano de obra</div>
              </div>
            </section>

            <footer class="support-footer">
              <p>¿Tienes alguna duda sobre tu orden?</p>
              <a href="https://wa.me/?text=Hola, tengo una consulta sobre mi orden %s en %s" target="_blank" class="whatsapp-btn">
                <span>💬 Consultar por WhatsApp</span>
              </a>
            </footer>
          </div>

          <script>
            async function submitDecision(accepted) {
              const token = '%s';
              const box = document.getElementById('approval-box');
              const feedback = document.getElementById('feedback-msg');
              const buttons = box.querySelectorAll('.btn');
              buttons.forEach(b => b.disabled = true);

              try {
                const res = await fetch('/api/public/work-orders/approve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token, accepted })
                });
                const data = await res.json();
                if (res.ok) {
                  feedback.style.display = 'block';
                  feedback.style.background = accepted ? '#dcfce7' : '#fee2e2';
                  feedback.style.color = accepted ? '#166534' : '#991b1b';
                  feedback.innerText = data.message || (accepted ? '¡Presupuesto aprobado!' : 'Presupuesto rechazado');
                  setTimeout(() => window.location.reload(), 1200);
                } else {
                  alert(data.message || 'No se pudo procesar la solicitud');
                  buttons.forEach(b => b.disabled = false);
                }
              } catch (err) {
                alert('Error de conexión al procesar');
                buttons.forEach(b => b.disabled = false);
              }
            }
          </script>
        </body>
        </html>
        """.formatted(
        storeName, orderNumber,
        storeName, branchName, orderNumber,
        status.toLowerCase(), statusTitle, statusTitle,
        step >= 1 ? (step == 1 ? "active" : "done") : "",
        step >= 2 ? (step == 2 ? "active" : "done") : "",
        step >= 3 ? (step == 3 ? "active" : "done") : "",
        step >= 4 ? (step == 4 ? "active" : "done") : "",
        step >= 5 ? "active done" : "",
        actionHtml,
        deviceText, (serial.isBlank() ? "No especificado" : serial),
        reportedFault, accessories,
        diagnosis,
        itemsTableSection,
        quote,
        orderNumber, storeName,
        token
    );
  }

  private String errorPortalHtml(String message) {
    return """
        <!doctype html>
        <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FixmeTiendas</title>
        <style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;padding:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;width:min(440px,100%%);box-shadow:0 12px 36px rgba(0,0,0,0.06);text-align:center}h1{color:#ef4444;font-size:22px;margin-bottom:10px}p{color:#64748b;font-size:14px}</style>
        </head><body><main class="card"><h1>Enlace no disponible</h1><p>%s</p></main></body></html>
        """.formatted(html(message));
  }

  // --- REPORTS & FINANCIAL ANALYTICS ---
  @GetMapping("/api/reports/summary")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> summary(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(required = false) String branchId,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to
  ) {
    UUID t = tenant(j);
    modules.require(t, "REPORTS");
    ctx(t);

    String salesFilter = " s.tenant_id=? AND s.status != 'CANCELLED' " + (branchId != null ? "AND s.branch_id=? " : "");
    List<Object> salesArgs = new ArrayList<>();
    salesArgs.add(t);
    if (branchId != null) salesArgs.add(id(branchId));
    if (from != null && !from.isBlank()) {
      salesFilter += "AND s.created_at >= ?::date ";
      salesArgs.add(from);
    }
    if (to != null && !to.isBlank()) {
      salesFilter += "AND s.created_at < (?::date + interval '1 day') ";
      salesArgs.add(to);
    }

    Map<String, Object> out = new LinkedHashMap<>();

    // 1. Core Sales & Profitability
    Long salesCount = db.queryForObject("SELECT count(*) FROM sales s WHERE " + salesFilter, salesArgs.toArray(), Long.class);
    BigDecimal revenue = db.queryForObject("SELECT coalesce(sum(s.total), 0) FROM sales s WHERE " + salesFilter, salesArgs.toArray(), BigDecimal.class);
    BigDecimal cogs = db.queryForObject(
        "SELECT coalesce(sum(si.quantity * si.cost_price), 0) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE " + salesFilter,
        salesArgs.toArray(), BigDecimal.class
    );
    BigDecimal grossProfit = (revenue != null ? revenue : BigDecimal.ZERO).subtract(cogs != null ? cogs : BigDecimal.ZERO);
    BigDecimal grossMarginPercent = (revenue != null && revenue.signum() > 0)
        ? grossProfit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, java.math.RoundingMode.HALF_UP)
        : BigDecimal.ZERO;

    out.put("sales", salesCount != null ? salesCount : 0L);
    out.put("revenue", revenue != null ? revenue : BigDecimal.ZERO);
    out.put("cogs", cogs != null ? cogs : BigDecimal.ZERO);
    out.put("grossProfit", grossProfit);
    out.put("grossMarginPercent", grossMarginPercent);

    // 2. Inventory Valuation (At Cost vs At Retail)
    String invFilter = " p.tenant_id=? " + (branchId != null ? "AND ps.branch_id=? " : "");
    List<Object> invArgs = new ArrayList<>();
    invArgs.add(t);
    if (branchId != null) invArgs.add(id(branchId));

    BigDecimal inventoryCostValue = db.queryForObject(
        "SELECT coalesce(sum(ps.stock * coalesce(p.purchase_price, 0)), 0) FROM product_stock ps JOIN products p ON p.id = ps.product_id WHERE " + invFilter,
        invArgs.toArray(), BigDecimal.class
    );
    BigDecimal inventoryRetailValue = db.queryForObject(
        "SELECT coalesce(sum(ps.stock * p.price), 0) FROM product_stock ps JOIN products p ON p.id = ps.product_id WHERE " + invFilter,
        invArgs.toArray(), BigDecimal.class
    );
    BigDecimal inventoryPotentialProfit = (inventoryRetailValue != null ? inventoryRetailValue : BigDecimal.ZERO)
        .subtract(inventoryCostValue != null ? inventoryCostValue : BigDecimal.ZERO);
    BigDecimal inventoryMarginPercent = (inventoryRetailValue != null && inventoryRetailValue.signum() > 0)
        ? inventoryPotentialProfit.multiply(BigDecimal.valueOf(100)).divide(inventoryRetailValue, 2, java.math.RoundingMode.HALF_UP)
        : BigDecimal.ZERO;
    Long totalStockUnits = db.queryForObject(
        "SELECT coalesce(sum(ps.stock), 0) FROM product_stock ps JOIN products p ON p.id = ps.product_id WHERE " + invFilter,
        invArgs.toArray(), Long.class
    );

    out.put("inventoryCostValue", inventoryCostValue != null ? inventoryCostValue : BigDecimal.ZERO);
    out.put("inventoryRetailValue", inventoryRetailValue != null ? inventoryRetailValue : BigDecimal.ZERO);
    out.put("inventoryPotentialProfit", inventoryPotentialProfit);
    out.put("inventoryMarginPercent", inventoryMarginPercent);
    out.put("totalStockUnits", totalStockUnits != null ? totalStockUnits : 0L);
    out.put("lowStock", db.queryForObject("SELECT count(*) FROM product_stock ps JOIN products p ON p.id = ps.product_id WHERE p.tenant_id=? AND ps.stock <= 5", new Object[]{t}, Long.class));

    // 3. Channels Breakdown (STORE vs ONLINE)
    Map<String, Object> channelStats = new LinkedHashMap<>();
    List<Map<String, Object>> channelRows = db.queryForList(
        "SELECT coalesce(s.channel, 'STORE') AS ch, count(*) AS cnt, coalesce(sum(s.total), 0) AS rev FROM sales s WHERE " + salesFilter + " GROUP BY coalesce(s.channel, 'STORE')",
        salesArgs.toArray()
    );
    for (Map<String, Object> crow : channelRows) {
      channelStats.put(String.valueOf(crow.get("ch")), Map.of(
          "count", crow.get("cnt"),
          "revenue", crow.get("rev")
      ));
    }
    out.put("channelBreakdown", channelStats);

    // 4. Fulfillment Breakdown (PICKUP vs DELIVERY)
    Map<String, Object> fulfillmentStats = new LinkedHashMap<>();
    List<Map<String, Object>> fulRows = db.queryForList(
        "SELECT coalesce(s.fulfillment_type, 'PICKUP') AS ft, count(*) AS cnt, coalesce(sum(s.total), 0) AS rev FROM sales s WHERE " + salesFilter + " GROUP BY coalesce(s.fulfillment_type, 'PICKUP')",
        salesArgs.toArray()
    );
    for (Map<String, Object> frow : fulRows) {
      fulfillmentStats.put(String.valueOf(frow.get("ft")), Map.of(
          "count", frow.get("cnt"),
          "revenue", frow.get("rev")
      ));
    }
    out.put("fulfillmentBreakdown", fulfillmentStats);

    // 5. Payment Methods Breakdown
    List<Map<String, Object>> payRows = db.queryForList(
        "SELECT p.payment_method, count(*) AS count, coalesce(sum(p.amount), 0) AS total " +
        "FROM payments p JOIN sales s ON s.id = p.sale_id WHERE " + salesFilter + " GROUP BY p.payment_method ORDER BY total DESC",
        salesArgs.toArray()
    );
    out.put("paymentMethods", payRows);

    // 6. Deliveries Summary
    String delivFilter = " tenant_id=? " + (branchId != null ? "AND branch_id=? " : "");
    List<Object> delivArgs = new ArrayList<>();
    delivArgs.add(t);
    if (branchId != null) delivArgs.add(id(branchId));
    List<Map<String, Object>> delivRows = db.queryForList(
        "SELECT status, count(*) AS count FROM deliveries WHERE " + delivFilter + " GROUP BY status",
        delivArgs.toArray()
    );
    Map<String, Long> delivMap = new LinkedHashMap<>();
    for (Map<String, Object> dr : delivRows) {
      delivMap.put(String.valueOf(dr.get("status")), ((Number) dr.get("count")).longValue());
    }
    out.put("deliveriesSummary", delivMap);

    // 7. Daily Trend (for charts)
    List<Map<String, Object>> trendRows = db.queryForList(
        """
        SELECT to_char(s.created_at, 'YYYY-MM-DD') AS day,
               coalesce(sum(s.total), 0) AS revenue,
               coalesce(sum(si.quantity * si.cost_price), 0) AS cogs,
               (coalesce(sum(s.total), 0) - coalesce(sum(si.quantity * si.cost_price), 0)) AS profit,
               count(DISTINCT s.id) AS sales_count
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE """ + salesFilter + """
        GROUP BY to_char(s.created_at, 'YYYY-MM-DD')
        ORDER BY day ASC
        LIMIT 30
        """,
        salesArgs.toArray()
    );
    out.put("dailyTrend", trendRows);

    // 8. Top 5 Products by Revenue & Profit
    List<Map<String, Object>> topRows = db.queryForList(
        """
        SELECT p.id, p.name, p.sku,
               coalesce(sum(si.quantity), 0) AS qty_sold,
               coalesce(sum(si.line_total), 0) AS total_revenue,
               coalesce(sum(si.quantity * si.cost_price), 0) AS total_cost,
               (coalesce(sum(si.line_total), 0) - coalesce(sum(si.quantity * si.cost_price), 0)) AS total_profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE """ + salesFilter + """
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT 5
        """,
        salesArgs.toArray()
    );
    out.put("topProducts", topRows);

    out.put("period", Map.of("from", from == null ? "" : from, "to", to == null ? "" : to));
    return out;
  }

  private UUID uuidOrNull(Object x) {
    return x == null || x.toString().isBlank() ? null : id(x.toString());
  }

  private BigDecimal decimal(Object x) {
    if (x == null || x.toString().isBlank()) return BigDecimal.ZERO;
    try {
      return new BigDecimal(x.toString());
    } catch (Exception e) {
      return BigDecimal.ZERO;
    }
  }

  private String html(String value) {
    if (value == null) return "";
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
  }
}
