package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class RepairMarketplaceController {
  private final JdbcTemplate db;
  private final SecureRandom random = new SecureRandom();

  private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

  public RepairMarketplaceController(JdbcTemplate db) {
    this.db = db;
  }

  private Object parseJson(Object val) {
    if (val == null) return List.of();
    if (val instanceof List) return val;
    String raw = val.toString().trim();
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        return mapper.readValue(raw, Object.class);
      } catch (Exception ignored) {}
    }
    return val;
  }

  private UUID tenant(Jwt jwt) {
    try {
      return UUID.fromString(Objects.requireNonNull(jwt.getClaimAsString("tenant_id")));
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tenant inválido");
    }
  }

  private UUID user(UUID t, String email) {
    ctx(t);
    return db.queryForObject("SELECT id FROM app_users WHERE tenant_id = ? AND lower(email) = lower(?)", UUID.class, t, email);
  }

  private void ctx(UUID t) {
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, t.toString());
  }

  private UUID id(String s) {
    try {
      return UUID.fromString(s);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID inválido: " + s);
    }
  }

  private BigDecimal decimal(Object val, BigDecimal fallback) {
    if (val == null) return fallback;
    try {
      return new BigDecimal(val.toString().trim());
    } catch (Exception e) {
      return fallback;
    }
  }

  private String normalizePhone(String raw) {
    if (raw == null) return "";
    String digits = raw.replaceAll("[^0-9]", "").trim();
    if (digits.startsWith("593") && digits.length() == 12) {
      digits = "0" + digits.substring(3);
    }
    return digits;
  }

  private UUID findOrCreateCustomerAccount(String rawPhone, String fullName, String email, String city, String address, String idNumber) {
    String phone = normalizePhone(rawPhone);
    if (phone.isBlank()) return null;

    List<Map<String, Object>> existing = db.queryForList(
        "SELECT id, full_name, email, city, address, identification_number FROM customer_accounts WHERE phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?",
        phone, phone
    );
    UUID accountId;
    if (!existing.isEmpty()) {
      accountId = (UUID) existing.get(0).get("id");
      String cleanName = (fullName != null && !fullName.isBlank() && !fullName.equals("Cliente Fixme") && !fullName.equals("Cliente Marketplace")) ? fullName.trim() : null;
      db.update("""
          UPDATE customer_accounts
          SET full_name = coalesce(?, full_name),
              email = coalesce(?, email),
              identification_number = coalesce(?, identification_number),
              city = CASE WHEN ? <> '' THEN ? ELSE city END,
              address = CASE WHEN ? <> '' THEN ? ELSE address END,
              updated_at = now()
          WHERE id = ?
          """,
          cleanName, email, idNumber,
          city != null ? city : "", city != null ? city : "",
          address != null ? address : "", address != null ? address : "",
          accountId
      );
    } else {
      // Check if this phone already existed in any store's customers table
      List<Map<String, Object>> storeCust = db.queryForList(
          "SELECT name, email, city, address, identification_number FROM customers WHERE phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ? ORDER BY created_at DESC LIMIT 1",
          phone, phone
      );
      String effName = (fullName != null && !fullName.isBlank() && !fullName.equals("Cliente Fixme") && !fullName.equals("Cliente Marketplace")) ? fullName.trim() : "Cliente Fixme";
      String effEmail = email;
      String effCity = city != null && !city.isBlank() ? city : "Quito";
      String effAddress = address != null ? address : "";
      String effIdNum = idNumber;

      if (!storeCust.isEmpty()) {
        Map<String, Object> prev = storeCust.get(0);
        if (effName.equals("Cliente Fixme") && prev.get("name") != null) effName = prev.get("name").toString();
        if (effEmail == null && prev.get("email") != null) effEmail = prev.get("email").toString();
        if (effAddress.isBlank() && prev.get("address") != null) effAddress = prev.get("address").toString();
        if (effIdNum == null && prev.get("identification_number") != null) effIdNum = prev.get("identification_number").toString();
      }

      accountId = UUID.randomUUID();
      db.update("""
          INSERT INTO customer_accounts (id, phone, email, full_name, city, address, identification_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, now(), now())
          ON CONFLICT (phone) DO UPDATE
          SET full_name = coalesce(EXCLUDED.full_name, customer_accounts.full_name),
              email = coalesce(EXCLUDED.email, customer_accounts.email),
              updated_at = now()
          """,
          accountId, phone, effEmail, effName, effCity, effAddress, effIdNum
      );
    }

    // Deduplication link: link all customers across all stores with this phone
    db.update("UPDATE customers SET customer_account_id = ? WHERE (phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?) AND (customer_account_id IS NULL OR customer_account_id <> ?)",
        accountId, phone, phone, accountId);
    // Link all prior repair requests with this phone
    db.update("UPDATE repair_requests SET customer_account_id = ? WHERE (customer_phone = ? OR regexp_replace(customer_phone, '[^0-9]', '', 'g') = ?) AND (customer_account_id IS NULL OR customer_account_id <> ?)",
        accountId, phone, phone, accountId);

    return accountId;
  }

  // =========================================================================
  // --- 1. CLIENTE / PORTAL PÚBLICO (SIN AUTENTICACIÓN) ---
  // =========================================================================

  /**
   * Public: Cliente publica una nueva solicitud de reparación con datos del equipo, falla, ubicación y fotos.
   */
  @PostMapping("/api/public/marketplace/requests")
  public ResponseEntity<Map<String, Object>> createPublicRequest(@RequestBody Map<String, Object> body) {
    String customerName = String.valueOf(body.getOrDefault("customerName", "")).trim();
    String customerPhone = String.valueOf(body.getOrDefault("customerPhone", "")).trim();
    String customerEmail = body.get("customerEmail") != null ? body.get("customerEmail").toString().trim() : null;
    String city = String.valueOf(body.getOrDefault("city", "Quito")).trim();
    String neighborhood = body.get("neighborhood") != null ? body.get("neighborhood").toString().trim() : "";
    String customerAddress = body.get("customerAddress") != null ? body.get("customerAddress").toString().trim() : "";
    String deliveryPref = String.valueOf(body.getOrDefault("deliveryPreference", "WORKSHOP")).trim();
    String deviceCategory = String.valueOf(body.getOrDefault("deviceCategory", "SMARTPHONE")).trim();
    String deviceBrand = String.valueOf(body.getOrDefault("deviceBrand", "")).trim();
    String deviceModel = String.valueOf(body.getOrDefault("deviceModel", "")).trim();
    String faultDescription = String.valueOf(body.getOrDefault("faultDescription", "")).trim();
    boolean powersOn = body.get("powersOn") == null || Boolean.parseBoolean(body.get("powersOn").toString());
    String urgency = String.valueOf(body.getOrDefault("urgency", "NORMAL")).trim();

    if (customerName.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre es obligatorio");
    if (customerPhone.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El teléfono de contacto / WhatsApp es obligatorio");
    if (deviceBrand.isBlank() || deviceModel.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La marca y modelo del equipo son obligatorios");
    if (faultDescription.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La descripción de la falla es obligatoria");

    UUID requestId = UUID.randomUUID();
    int randSuffix = 1000 + random.nextInt(9000);
    String requestCode = "SOL-" + Calendar.getInstance().get(Calendar.YEAR) + "-" + randSuffix;
    String accessToken = "tok_" + UUID.randomUUID().toString().replace("-", "");

    // Unificación de identidad y deduplicación automática de cuenta cliente
    String rawIdNum = body.get("identificationNumber") != null ? body.get("identificationNumber").toString().trim() : (body.get("cedula") != null ? body.get("cedula").toString().trim() : "");
    String cleanId = rawIdNum.replaceAll("[^0-9a-zA-Z]", "");
    UUID customerAccountId = findOrCreateCustomerAccount(customerPhone, customerName, customerEmail, city, customerAddress, cleanId.isBlank() ? null : cleanId);

    db.update("""
        INSERT INTO repair_requests (
            id, request_code, customer_name, customer_phone, customer_email,
            city, neighborhood, customer_address, delivery_preference,
            device_category, device_brand, device_model, powers_on,
            fault_description, urgency, status, access_token, customer_account_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, now(), now())
        """,
        requestId, requestCode, customerName, normalizePhone(customerPhone), customerEmail,
        city, neighborhood, customerAddress, deliveryPref,
        deviceCategory, deviceBrand, deviceModel, powersOn,
        faultDescription, urgency, accessToken, customerAccountId
    );

    // Guardar fotos adjuntas
    if (body.get("images") instanceof List<?> rawImages) {
      for (Object item : rawImages) {
        if (item instanceof Map<?, ?> imgMap) {
          String url = imgMap.get("imageUrl") != null ? imgMap.get("imageUrl").toString() : "";
          String fileName = imgMap.get("fileName") != null ? imgMap.get("fileName").toString() : "foto.jpg";
          if (!url.isBlank()) {
            db.update("INSERT INTO repair_request_images (id, request_id, image_url, file_name, created_at) VALUES (uuid_generate_v4(), ?, ?, ?, now())",
                requestId, url, fileName);
          }
        } else if (item instanceof String url && !url.isBlank()) {
          db.update("INSERT INTO repair_request_images (id, request_id, image_url, file_name, created_at) VALUES (uuid_generate_v4(), ?, ?, 'foto.jpg', now())",
              requestId, url);
        }
      }
    }

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("success", true);
    resp.put("id", requestId);
    resp.put("requestCode", requestCode);
    resp.put("accessToken", accessToken);
    resp.put("trackingUrl", "/#/solicitud/" + requestCode + "?token=" + accessToken);
    return ResponseEntity.status(HttpStatus.CREATED).body(resp);
  }

  /**
   * Public: Consultar solicitud y ver cotizaciones recibidas de los talleres.
   */
  @GetMapping("/api/public/marketplace/requests/{code}")
  public ResponseEntity<Map<String, Object>> getPublicRequest(
      @PathVariable String code,
      @RequestParam(required = false) String token
  ) {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT r.*,
               (SELECT json_agg(json_build_object('id', img.id, 'imageUrl', img.image_url, 'fileName', img.file_name))
                FROM repair_request_images img WHERE img.request_id = r.id) AS images
        FROM repair_requests r
        WHERE r.request_code = ? OR r.id::text = ?
        """, code, code);

    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud de reparación no encontrada");
    }

    Map<String, Object> req = new LinkedHashMap<>(rows.get(0));
    UUID reqId = (UUID) req.get("id");

    // Traer ofertas / cotizaciones de los talleres con datos del negocio
    // Si el cliente ya aceptó una cotización, las demás ya no se muestran
    boolean isAccepted = "ACCEPTED".equalsIgnoreCase(String.valueOf(req.get("status")))
        || req.get("selected_bid_id") != null;

    String bidsSql = isAccepted
        ? """
        SELECT b.id, b.tenant_id, b.estimated_cost, b.estimated_time, b.warranty_terms,
               b.spare_part_quality, b.proposal_notes, b.status, b.created_at,
               t.name as store_name, t.phone as store_phone, t.address as store_address,
               t.catalog_description as store_slogan, t.logo_url as store_logo
        FROM repair_bids b
        JOIN tenants t ON t.id = b.tenant_id
        WHERE b.request_id = ? AND b.status = 'ACCEPTED'
        ORDER BY b.created_at ASC
        """
        : """
        SELECT b.id, b.tenant_id, b.estimated_cost, b.estimated_time, b.warranty_terms,
               b.spare_part_quality, b.proposal_notes, b.status, b.created_at,
               t.name as store_name, t.phone as store_phone, t.address as store_address,
               t.catalog_description as store_slogan, t.logo_url as store_logo
        FROM repair_bids b
        JOIN tenants t ON t.id = b.tenant_id
        WHERE b.request_id = ?
        ORDER BY (b.status = 'ACCEPTED') DESC, b.estimated_cost ASC, b.created_at ASC
        """;

    List<Map<String, Object>> bids = db.queryForList(bidsSql, reqId);

    req.put("bids", bids);
    return ResponseEntity.ok(req);
  }

  /**
   * Public: Cliente acepta una cotización de un taller.
   * Auto-convierte a Cliente y Orden de Trabajo (OT) en el sistema del taller ganador.
   */
  @PostMapping("/api/public/marketplace/requests/{code}/accept-bid")
  public ResponseEntity<Map<String, Object>> acceptPublicBid(
      @PathVariable String code,
      @RequestBody Map<String, Object> body
  ) {
    String bidIdStr = String.valueOf(body.getOrDefault("bidId", "")).trim();
    if (bidIdStr.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El ID de la cotización es obligatorio");

    List<Map<String, Object>> reqRows = db.queryForList("SELECT * FROM repair_requests WHERE request_code = ? OR id::text = ?", code, code);
    if (reqRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada");
    Map<String, Object> req = reqRows.get(0);
    UUID reqId = (UUID) req.get("id");

    List<Map<String, Object>> bidRows = db.queryForList("""
        SELECT b.*, t.name as store_name, t.phone as store_phone, t.address as store_address
        FROM repair_bids b
        JOIN tenants t ON t.id = b.tenant_id
        WHERE b.id = ? AND b.request_id = ?
        """, id(bidIdStr), reqId);

    if (bidRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cotización no encontrada para esta solicitud");
    Map<String, Object> bid = bidRows.get(0);
    UUID bidId = (UUID) bid.get("id");
    UUID winningTenantId = (UUID) bid.get("tenant_id");
    BigDecimal quotedPrice = (BigDecimal) bid.get("estimated_cost");
    String warrantyTerms = (String) bid.get("warranty_terms");

    // 1. Actualizar estados de cotizaciones y solicitud
    db.update("UPDATE repair_bids SET status = 'ACCEPTED', updated_at = now() WHERE id = ?", bidId);
    db.update("UPDATE repair_bids SET status = 'REJECTED', updated_at = now() WHERE request_id = ? AND id <> ?", reqId, bidId);
    db.update("UPDATE repair_requests SET status = 'ACCEPTED', selected_bid_id = ?, selected_tenant_id = ?, updated_at = now() WHERE id = ?",
        bidId, winningTenantId, reqId);

    // 2. Auto-crear o vincular cliente en el tenant ganador (Deduplicación multi-tienda)
    ctx(winningTenantId);
    String custPhone = normalizePhone(String.valueOf(req.getOrDefault("customer_phone", "")).trim());
    String custName = String.valueOf(req.getOrDefault("customer_name", "Cliente Marketplace")).trim();
    String custEmail = req.get("customer_email") != null ? req.get("customer_email").toString().trim() : null;
    String custAddress = req.get("customer_address") != null ? req.get("customer_address").toString().trim() : "";
    String custCity = String.valueOf(req.getOrDefault("city", "Quito")).trim();

    UUID accountId = req.get("customer_account_id") != null
        ? (UUID) req.get("customer_account_id")
        : findOrCreateCustomerAccount(custPhone, custName, custEmail, custCity, custAddress, null);

    UUID customerId;
    List<Map<String, Object>> existingCust = db.queryForList("""
        SELECT id FROM customers
        WHERE tenant_id = ? AND (
            phone = ? OR
            regexp_replace(phone, '[^0-9]', '', 'g') = ? OR
            (customer_account_id IS NOT NULL AND customer_account_id = ?)
        ) LIMIT 1
        """,
        winningTenantId, custPhone, custPhone, accountId
    );
    if (!existingCust.isEmpty()) {
      customerId = (UUID) existingCust.get(0).get("id");
      db.update("UPDATE customers SET customer_account_id = coalesce(customer_account_id, ?) WHERE id = ?", accountId, customerId);
    } else {
      customerId = UUID.randomUUID();
      db.update("""
          INSERT INTO customers (id, tenant_id, name, email, phone, address, city, tag, customer_account_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'MARKETPLACE', ?, now())
          """,
          customerId, winningTenantId, custName, custEmail, custPhone, custAddress, custCity, accountId
      );
    }

    // 3. Auto-crear Orden de Trabajo (OT) en el taller
    Integer count = db.queryForObject("SELECT count(*) FROM work_orders WHERE tenant_id = ?", Integer.class, winningTenantId);
    int nextNum = (count == null ? 0 : count) + 1001;
    String orderNumber = "OT-" + nextNum;
    UUID newOrderId = UUID.randomUUID();

    String brand = String.valueOf(req.getOrDefault("device_brand", ""));
    String model = String.valueOf(req.getOrDefault("device_model", ""));
    String fault = String.valueOf(req.getOrDefault("fault_description", "Servicio Técnico"));
    String deliveryPref = String.valueOf(req.getOrDefault("delivery_preference", "WORKSHOP"));

    db.update("""
        INSERT INTO work_orders (
            id, tenant_id, customer_id, order_number, device_brand, device_model,
            description, reported_fault, quote, status, warranty_terms,
            origin_marketplace_request_id, delivery_mode, customer_address,
            sla_hours, sla_deadline, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, 'APPROVED', ?,
            ?, ?, ?,
            48, now() + interval '48 hours', now(), now()
        )
        """,
        newOrderId, winningTenantId, customerId, orderNumber, brand, model,
        brand + " " + model + " - " + fault, fault, quotedPrice, warrantyTerms,
        reqId, deliveryPref, custAddress
    );

    // Vincular la OT a la cotización ganadora
    db.update("UPDATE repair_bids SET converted_work_order_id = ? WHERE id = ?", newOrderId, bidId);

    // 4. Preparar respuesta y enlace directo a WhatsApp
    String storeName = String.valueOf(bid.getOrDefault("store_name", "Taller Técnico"));
    String storePhone = String.valueOf(bid.getOrDefault("store_phone", "")).replaceAll("[^0-9]", "");
    if (storePhone.startsWith("0")) storePhone = "593" + storePhone.substring(1);

    String waMsg = String.format(
        "¡Hola %s! Acepté su cotización de $%.2f para reparar mi %s %s (Solicitud %s). Mi número de orden generada es %s. ¿Cuándo puedo coordinar la entrega o retiro?",
        storeName, quotedPrice.doubleValue(), brand, model, code, orderNumber
    );
    String waUrl = "https://wa.me/" + storePhone + "?text=" + URLEncoder.encode(waMsg, StandardCharsets.UTF_8);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("message", "¡Cotización aceptada con éxito! Tu orden de trabajo ha sido generada en " + storeName);
    out.put("orderNumber", orderNumber);
    out.put("workOrderId", newOrderId);
    out.put("storeName", storeName);
    out.put("storePhone", bid.get("store_phone"));
    out.put("storeAddress", bid.get("store_address"));
    out.put("whatsappUrl", waUrl);
    return ResponseEntity.ok(out);
  }

  // =========================================================================
  // --- 2. TIENDAS / TALLERES REGISTRADOS (CON AUTENTICACIÓN JWT) ---
  // =========================================================================

  /**
   * Taller: Explorar la Bolsa de Leads / Solicitudes abiertas disponibles para cotizar.
   */
  @GetMapping("/api/marketplace/leads")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<List<Map<String, Object>>> listLeads(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) String city,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String search
  ) {
    UUID t = tenant(jwt);

    StringBuilder sql = new StringBuilder("""
        SELECT r.id, r.request_code, r.customer_name, r.city, r.neighborhood,
               r.delivery_preference, r.device_category, r.device_brand, r.device_model,
               r.powers_on, r.fault_description, r.urgency, r.status, r.created_at,
               (SELECT count(*) FROM repair_bids b WHERE b.request_id = r.id) as total_bids,
               (SELECT json_build_object(
                   'id', my_b.id, 'estimatedCost', my_b.estimated_cost,
                   'estimatedTime', my_b.estimated_time, 'warrantyTerms', my_b.warranty_terms,
                   'sparePartQuality', my_b.spare_part_quality, 'proposalNotes', my_b.proposal_notes,
                   'status', my_b.status, 'convertedWorkOrderId', my_b.converted_work_order_id
               ) FROM repair_bids my_b WHERE my_b.request_id = r.id AND my_b.tenant_id = ?) as my_bid,
               (SELECT json_agg(json_build_object('id', img.id, 'imageUrl', img.image_url, 'fileName', img.file_name))
                FROM repair_request_images img WHERE img.request_id = r.id) as images
        FROM repair_requests r
        WHERE r.status IN ('OPEN', 'QUOTED')
        """);

    List<Object> params = new ArrayList<>();
    params.add(t);

    if (city != null && !city.isBlank() && !city.equalsIgnoreCase("ALL")) {
      sql.append(" AND lower(r.city) = lower(?) ");
      params.add(city.trim());
    }
    if (category != null && !category.isBlank() && !category.equalsIgnoreCase("ALL")) {
      sql.append(" AND upper(r.device_category) = upper(?) ");
      params.add(category.trim());
    }
    if (search != null && !search.isBlank()) {
      sql.append(" AND (lower(r.device_brand) LIKE ? OR lower(r.device_model) LIKE ? OR lower(r.fault_description) LIKE ?) ");
      String p = "%" + search.trim().toLowerCase() + "%";
      params.add(p);
      params.add(p);
      params.add(p);
    }

    sql.append(" ORDER BY r.created_at DESC LIMIT 50");
    List<Map<String, Object>> leads = db.queryForList(sql.toString(), params.toArray());
    return ResponseEntity.ok(leads);
  }

  /**
   * Taller: Obtener detalle completo de una solicitud para cotizar.
   */
  @GetMapping("/api/marketplace/leads/{id}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> getLeadDetail(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String id
  ) {
    UUID t = tenant(jwt);
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT r.*,
               (SELECT json_agg(json_build_object('id', img.id, 'imageUrl', img.image_url, 'fileName', img.file_name))
                FROM repair_request_images img WHERE img.request_id = r.id) as images,
               (SELECT json_build_object(
                   'id', my_b.id, 'estimatedCost', my_b.estimated_cost,
                   'estimatedTime', my_b.estimated_time, 'warrantyTerms', my_b.warranty_terms,
                   'sparePartQuality', my_b.spare_part_quality, 'proposalNotes', my_b.proposal_notes,
                   'status', my_b.status, 'convertedWorkOrderId', my_b.converted_work_order_id
               ) FROM repair_bids my_b WHERE my_b.request_id = r.id AND my_b.tenant_id = ?) as my_bid
        FROM repair_requests r
        WHERE r.id = ?
        """, t, id(id));

    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead no encontrado");
    return ResponseEntity.ok(rows.get(0));
  }

  /**
   * Taller: Enviar o actualizar una cotización para una solicitud abierta.
   */
  @PostMapping("/api/marketplace/leads/{id}/bids")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> submitBid(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String id,
      @RequestBody Map<String, Object> body
  ) {
    UUID t = tenant(jwt);
    UUID reqId = id(id);
    UUID userId = null;
    try {
      userId = user(t, jwt.getSubject());
    } catch (Exception ignored) {}

    BigDecimal cost = decimal(body.get("estimatedCost"), null);
    if (cost == null || cost.compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El precio cotizado debe ser mayor a 0");
    }

    String estTime = String.valueOf(body.getOrDefault("estimatedTime", "24 a 48 horas")).trim();
    String warrantyTerms = body.get("warrantyTerms") != null ? body.get("warrantyTerms").toString().trim() : "90 días de garantía";
    String spareQuality = body.get("sparePartQuality") != null ? body.get("sparePartQuality").toString().trim() : "Original";
    String proposalNotes = body.get("proposalNotes") != null ? body.get("proposalNotes").toString().trim() : "";

    // Verificar que la solicitud sigue abierta
    List<Map<String, Object>> reqRows = db.queryForList("SELECT status FROM repair_requests WHERE id = ?", reqId);
    if (reqRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada");
    String reqStatus = String.valueOf(reqRows.get(0).get("status"));
    if ("ACCEPTED".equalsIgnoreCase(reqStatus) || "COMPLETED".equalsIgnoreCase(reqStatus) || "CANCELLED".equalsIgnoreCase(reqStatus)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta solicitud ya no está disponible para cotizaciones");
    }

    // Upsert cotización
    List<Map<String, Object>> existingBid = db.queryForList(
        "SELECT id FROM repair_bids WHERE request_id = ? AND tenant_id = ?", reqId, t
    );

    UUID bidId;
    if (!existingBid.isEmpty()) {
      bidId = (UUID) existingBid.get(0).get("id");
      db.update("""
          UPDATE repair_bids
          SET estimated_cost = ?, estimated_time = ?, warranty_terms = ?,
              spare_part_quality = ?, proposal_notes = ?, updated_at = now()
          WHERE id = ?
          """,
          cost, estTime, warrantyTerms, spareQuality, proposalNotes, bidId
      );
    } else {
      bidId = UUID.randomUUID();
      db.update("""
          INSERT INTO repair_bids (
              id, request_id, tenant_id, user_id, estimated_cost,
              estimated_time, warranty_terms, spare_part_quality, proposal_notes,
              status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', now(), now())
          """,
          bidId, reqId, t, userId, cost, estTime, warrantyTerms, spareQuality, proposalNotes
      );
    }

    // Actualizar estado de la solicitud a QUOTED si estaba en OPEN
    db.update("UPDATE repair_requests SET status = 'QUOTED', updated_at = now() WHERE id = ? AND status = 'OPEN'", reqId);

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("success", true);
    resp.put("bidId", bidId);
    resp.put("message", "¡Cotización enviada exitosamente al cliente!");
    return ResponseEntity.ok(resp);
  }

  /**
   * Taller: Ver todas las cotizaciones que ha enviado la tienda y su estado.
   */
  @GetMapping("/api/marketplace/my-bids")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<List<Map<String, Object>>> getMyBids(@AuthenticationPrincipal Jwt jwt) {
    UUID t = tenant(jwt);
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT b.id as bid_id, b.estimated_cost, b.estimated_time, b.warranty_terms,
               b.spare_part_quality, b.proposal_notes, b.status as bid_status,
               b.created_at as bid_created_at, b.converted_work_order_id,
               r.id as request_id, r.request_code, r.customer_name, r.customer_phone,
               r.city, r.neighborhood, r.delivery_preference, r.device_category,
               r.device_brand, r.device_model, r.fault_description, r.status as request_status,
               wo.order_number as work_order_number, wo.status as work_order_status
        FROM repair_bids b
        JOIN repair_requests r ON r.id = b.request_id
        LEFT JOIN work_orders wo ON wo.id = b.converted_work_order_id
        WHERE b.tenant_id = ?
        ORDER BY b.created_at DESC
        """, t);
    return ResponseEntity.ok(rows);
  }

  // =========================================================================
  // --- 3. CIERRE DE ORDEN DE TRABAJO: COBRO Y REGISTRO DE GARANTÍA ---
  // =========================================================================

  /**
   * Taller: Finalizar y entregar una orden de trabajo registrando la forma de pago y emitiendo la garantía oficial.
   */
  @PostMapping("/api/work-orders/{id}/checkout")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Map<String, Object>> checkoutWorkOrder(
      @PathVariable String id,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, Object> body
  ) {
    UUID t = tenant(jwt);
    ctx(t);
    UUID orderId = id(id);

    List<Map<String, Object>> orderRows = db.queryForList("SELECT * FROM work_orders WHERE id = ? AND tenant_id = ?", orderId, t);
    if (orderRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden de trabajo no encontrada");
    Map<String, Object> order = orderRows.get(0);

    String paymentMethod = String.valueOf(body.getOrDefault("paymentMethod", "CASH")).toUpperCase(Locale.ROOT);
    BigDecimal paymentAmount = decimal(body.get("paymentAmount"), (BigDecimal) order.get("quote"));
    if (paymentAmount == null || paymentAmount.compareTo(BigDecimal.ZERO) < 0) {
      paymentAmount = BigDecimal.ZERO;
    }

    int warrantyDays = 30;
    if (body.get("warrantyDays") != null) {
      try {
        warrantyDays = Integer.parseInt(body.get("warrantyDays").toString());
      } catch (Exception ignored) {}
    }

    String warrantyTerms = body.get("warrantyTerms") != null
        ? body.get("warrantyTerms").toString().trim()
        : "Garantía de servicio técnico en mano de obra y repuestos especificados.";
    String techNotes = body.get("technicianNotes") != null ? body.get("technicianNotes").toString().trim() : (String) order.get("technician_notes");
    String nextStatus = body.get("status") != null ? body.get("status").toString().trim() : "DELIVERED";

    // Generar código de garantía
    String orderNum = String.valueOf(order.getOrDefault("order_number", "OT"));
    String warrantyCode = "GAR-" + orderNum;
    UUID warrantyId = UUID.randomUUID();
    UUID customerId = (UUID) order.get("customer_id");

    String brand = String.valueOf(order.getOrDefault("device_brand", ""));
    String model = String.valueOf(order.getOrDefault("device_model", ""));
    String fault = String.valueOf(order.getOrDefault("reported_fault", "Servicio Técnico"));
    String serviceDesc = (brand + " " + model + " - " + fault).trim();

    // 1. Crear registro formal en tabla warranties
    db.update("""
        INSERT INTO warranties (
            id, tenant_id, customer_id, work_order_id, warranty_code,
            starts_at, expires_at, terms, status, service_description,
            warranty_days, serial_number, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            now(), now() + (? || ' days')::interval, ?, 'ACTIVE', ?,
            ?, ?, now(), now()
        )
        ON CONFLICT (id) DO NOTHING
        """,
        warrantyId, t, customerId, orderId, warrantyCode,
        warrantyDays, warrantyTerms, serviceDesc,
        warrantyDays, order.get("serial_number")
    );

    // 2. Actualizar la orden de trabajo con el cobro y la garantía
    db.update("""
        UPDATE work_orders
        SET status = ?, payment_method = ?, payment_amount = ?, paid_at = now(),
            delivered_at = now(), warranty_days = ?, warranty_terms = ?,
            warranty_id = ?, technician_notes = ?, updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        nextStatus, paymentMethod, paymentAmount, warrantyDays, warrantyTerms,
        warrantyId, techNotes, orderId, t
    );

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("success", true);
    resp.put("message", "¡Trabajo cobrado, garantía emitida y orden finalizada!");
    resp.put("orderId", orderId);
    resp.put("status", nextStatus);
    resp.put("paymentMethod", paymentMethod);
    resp.put("paymentAmount", paymentAmount);
    resp.put("warrantyCode", warrantyCode);
    resp.put("warrantyDays", warrantyDays);
    resp.put("warrantyId", warrantyId);
    return ResponseEntity.ok(resp);
  }

  // =========================================================================
  // --- 4. PORTAL DEL CLIENTE 360 & APROBACIÓN DE REPUESTOS EXTRAS ---
  // =========================================================================

  /**
   * Public: Registro o inicio de sesión seguro para cliente final con Celular WhatsApp y Cédula/RUC.
   */
  @PostMapping("/api/public/customer/auth")
  public ResponseEntity<Map<String, Object>> customerAuth(@RequestBody Map<String, Object> body) {
    String rawPhone = String.valueOf(body.getOrDefault("phone", "")).trim();
    String phone = normalizePhone(rawPhone);
    if (phone.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El número de WhatsApp o celular es obligatorio");

    String rawIdNum = body.get("identificationNumber") != null ? body.get("identificationNumber").toString().trim() : "";
    if (rawIdNum.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El número de cédula o RUC es obligatorio para acceder");
    }
    String idNumber = rawIdNum.replaceAll("[^0-9a-zA-Z]", "");

    String action = String.valueOf(body.getOrDefault("action", "LOGIN")).toUpperCase();
    String fullName = body.get("fullName") != null ? body.get("fullName").toString().trim() : "";
    String email = body.get("email") != null ? body.get("email").toString().trim() : null;
    String city = body.get("city") != null ? body.get("city").toString().trim() : "Quito";
    String address = body.get("address") != null ? body.get("address").toString().trim() : "";

    // 1. Buscar en cuentas globales por celular o cédula
    List<Map<String, Object>> existingAccounts = db.queryForList("""
        SELECT * FROM customer_accounts
        WHERE phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?
           OR (identification_number IS NOT NULL AND identification_number = ?)
        LIMIT 1
        """, phone, phone, idNumber);

    UUID accountId;
    Map<String, Object> account;
    boolean alreadyExisted = false;

    if (!existingAccounts.isEmpty()) {
      account = new LinkedHashMap<>(existingAccounts.get(0));
      accountId = (UUID) account.get("id");
      alreadyExisted = true;
      String existingIdNum = account.get("identification_number") != null
          ? account.get("identification_number").toString().trim().replaceAll("[^0-9a-zA-Z]", "")
          : "";

      // Si ya tenía cédula registrada, verificar que coincida
      if (!existingIdNum.isBlank() && !existingIdNum.equalsIgnoreCase(idNumber)) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La cédula ingresada (" + idNumber + ") no coincide con el número de celular registrado");
      }

      // Si no tenía cédula, vincularla
      if (existingIdNum.isBlank()) {
        db.update("UPDATE customer_accounts SET identification_number = ?, updated_at = now() WHERE id = ?", idNumber, accountId);
        account.put("identification_number", idNumber);
      }

      // Actualizar datos de perfil si se suministran
      if (!fullName.isBlank() || email != null || !address.isBlank()) {
        db.update("""
            UPDATE customer_accounts
            SET full_name = CASE WHEN ? <> '' AND ? <> 'Cliente Fixme' THEN ? ELSE full_name END,
                email = coalesce(?, email),
                city = CASE WHEN ? <> '' THEN ? ELSE city END,
                address = CASE WHEN ? <> '' THEN ? ELSE address END,
                updated_at = now()
            WHERE id = ?
            """,
            fullName, fullName, fullName, email, city, city, address, address, accountId
        );
        if (!fullName.isBlank() && !fullName.equals("Cliente Fixme")) account.put("full_name", fullName);
        if (email != null) account.put("email", email);
      }
    } else {
      // 2. Si no estaba en customer_accounts, buscar en customers de alguna tienda
      List<Map<String, Object>> storeCust = db.queryForList("""
          SELECT name, email, city, address, identification_number
          FROM customers
          WHERE phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?
             OR (identification_number IS NOT NULL AND identification_number = ?)
          ORDER BY created_at DESC LIMIT 1
          """, phone, phone, idNumber);

      if (!storeCust.isEmpty()) {
        alreadyExisted = true;
        Map<String, Object> prev = storeCust.get(0);
        String storeIdNum = prev.get("identification_number") != null ? prev.get("identification_number").toString().trim().replaceAll("[^0-9a-zA-Z]", "") : "";
        if (!storeIdNum.isBlank() && !storeIdNum.equalsIgnoreCase(idNumber)) {
          throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La cédula ingresada no coincide con el registro previo en la tienda");
        }
        String effName = !fullName.isBlank() && !fullName.equals("Cliente Fixme") ? fullName : (prev.get("name") != null ? prev.get("name").toString() : "Cliente Fixme");
        String effEmail = email != null ? email : (prev.get("email") != null ? prev.get("email").toString() : null);
        String effCity = !city.isBlank() ? city : (prev.get("city") != null ? prev.get("city").toString() : "Quito");
        String effAddress = !address.isBlank() ? address : (prev.get("address") != null ? prev.get("address").toString() : "");

        accountId = UUID.randomUUID();
        db.update("""
            INSERT INTO customer_accounts (id, phone, email, full_name, city, address, identification_number, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, now(), now())
            """,
            accountId, phone, effEmail, effName, effCity, effAddress, idNumber
        );
      } else {
        // No existe en ningún registro previo
        if ("LOGIN".equals(action) && (fullName.isBlank() || fullName.equals("Cliente Fixme"))) {
          throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontramos una cuenta con ese celular y cédula. Por favor regístrate en la pestaña 'Crear Cuenta Nueva'.");
        }
        String effName = !fullName.isBlank() ? fullName : "Cliente Fixme";
        accountId = UUID.randomUUID();
        db.update("""
            INSERT INTO customer_accounts (id, phone, email, full_name, city, address, identification_number, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, now(), now())
            """,
            accountId, phone, email, effName, city, address, idNumber
        );
      }
      account = db.queryForMap("SELECT * FROM customer_accounts WHERE id = ?", accountId);
    }

    // Unificación de referencias
    db.update("""
        UPDATE customers SET customer_account_id = ?
        WHERE (phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ? OR identification_number = ?)
          AND (customer_account_id IS NULL OR customer_account_id <> ?)
        """,
        accountId, phone, phone, idNumber, accountId
    );
    db.update("""
        UPDATE repair_requests SET customer_account_id = ?
        WHERE (customer_phone = ? OR regexp_replace(customer_phone, '[^0-9]', '', 'g') = ?)
          AND (customer_account_id IS NULL OR customer_account_id <> ?)
        """,
        accountId, phone, phone, accountId
    );

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("alreadyExisted", alreadyExisted);
    out.put("account", account);
    return ResponseEntity.ok(out);
  }

  /**
   * Public: Consultar el expediente completo del cliente 360 (Reparaciones, Solicitudes, Compras, Garantías).
   */
  @GetMapping("/api/public/customer/portal")
  public ResponseEntity<Map<String, Object>> getCustomerPortal(
      @RequestParam String phone,
      @RequestParam(required = false) String cedula,
      @RequestParam(required = false) String identificationNumber
  ) {
    String cleanPhone = normalizePhone(phone);
    if (cleanPhone.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Teléfono obligatorio");

    String rawId = identificationNumber != null && !identificationNumber.isBlank()
        ? identificationNumber.trim()
        : (cedula != null ? cedula.trim() : "");
    String cleanId = rawId.replaceAll("[^0-9a-zA-Z]", "");

    // 1. Cuenta del cliente (Deduplicación & Búsqueda Unificada)
    List<Map<String, Object>> accList = db.queryForList("""
        SELECT * FROM customer_accounts
        WHERE (phone = ? OR regexp_replace(phone, '[^0-9]', '', 'g') = ?)
           OR (? <> '' AND identification_number = ?)
        LIMIT 1
        """, cleanPhone, cleanPhone, cleanId, cleanId);

    UUID accountId;
    Map<String, Object> account;
    if (!accList.isEmpty()) {
      account = accList.get(0);
      accountId = (UUID) account.get("id");
      String regId = account.get("identification_number") != null
          ? account.get("identification_number").toString().trim().replaceAll("[^0-9a-zA-Z]", "")
          : "";
      if (!cleanId.isBlank() && !regId.isBlank() && !regId.equalsIgnoreCase(cleanId)) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cédula no coincide con el expediente de esta cuenta");
      }
      if (!cleanId.isBlank() && regId.isBlank()) {
        db.update("UPDATE customer_accounts SET identification_number = ?, updated_at = now() WHERE id = ?", cleanId, accountId);
      }
    } else {
      accountId = findOrCreateCustomerAccount(cleanPhone, "Cliente Fixme", null, "Quito", "", cleanId);
      account = db.queryForMap("SELECT * FROM customer_accounts WHERE id = ?", accountId);
    }

    // 2. Solicitudes en Marketplace
    List<Map<String, Object>> requests = db.queryForList("""
        SELECT r.*,
               (SELECT count(*) FROM repair_bids b WHERE b.request_id = r.id AND (r.status <> 'ACCEPTED' OR b.status = 'ACCEPTED')) as bids_count,
               coalesce((SELECT json_agg(json_build_object(
                   'id', b.id, 'tenant_id', b.tenant_id, 'estimated_cost', b.estimated_cost,
                   'estimated_time', b.estimated_time, 'warranty_terms', b.warranty_terms,
                   'spare_part_quality', b.spare_part_quality, 'proposal_notes', b.proposal_notes,
                   'status', b.status, 'store_name', t.name, 'store_phone', t.phone, 'store_address', t.address
               )) FROM repair_bids b JOIN tenants t ON t.id = b.tenant_id
                  WHERE b.request_id = r.id AND (r.status <> 'ACCEPTED' OR b.status = 'ACCEPTED')), '[]'::json) as bids,
               coalesce((SELECT json_agg(json_build_object('id', img.id, 'imageUrl', img.image_url, 'fileName', img.file_name))
                FROM repair_request_images img WHERE img.request_id = r.id), '[]'::json) as images
        FROM repair_requests r
        WHERE r.customer_account_id = ?
           OR r.customer_phone = ?
           OR regexp_replace(r.customer_phone, '[^0-9]', '', 'g') = ?
        ORDER BY r.created_at DESC
        """, accountId, cleanPhone, cleanPhone);

    // 3. Órdenes de Trabajo en curso o históricas
    List<Map<String, Object>> workOrders = db.queryForList("""
        SELECT wo.id, wo.order_number, wo.device_brand, wo.device_model, wo.serial_number,
               wo.reported_fault, wo.diagnosis, wo.quote, wo.status, wo.technician_notes,
               wo.client_notes, wo.rejection_reason, wo.warranty_terms, wo.warranty_days,
               wo.payment_method, wo.payment_amount, wo.created_at, wo.approved_at,
               wo.delivered_at, wo.sla_deadline,
               wo.intake_checklist, wo.legal_disclaimer_accepted,
               c.name as customer_name, c.phone as customer_phone, c.identification_number as customer_cedula,
               t.name as store_name, t.phone as store_phone, t.address as store_address,
               coalesce((SELECT json_agg(json_build_object(
                   'id', woi.id, 'itemType', woi.item_type, 'name', woi.name,
                   'quantity', woi.quantity, 'unitPrice', woi.unit_price, 'subtotal', woi.subtotal
               )) FROM work_order_items woi WHERE woi.work_order_id = wo.id), '[]'::json) as items,
               coalesce((SELECT json_agg(json_build_object(
                   'id', img.id, 'stage', img.stage, 'imageUrl', img.image_url, 'caption', img.caption, 'createdAt', img.created_at
               ) ORDER BY img.created_at ASC) FROM work_order_images img WHERE img.work_order_id = wo.id), '[]'::json) as images
        FROM work_orders wo
        JOIN customers c ON c.id = wo.customer_id
        JOIN tenants t ON t.id = wo.tenant_id
        WHERE c.customer_account_id = ?
           OR c.phone = ?
           OR regexp_replace(c.phone, '[^0-9]', '', 'g') = ?
           OR (? <> '' AND c.identification_number = ?)
           OR wo.customer_address LIKE ?
        ORDER BY wo.created_at DESC
        """, accountId, cleanPhone, cleanPhone, cleanId, cleanId, "%" + cleanPhone + "%");

    // 4. Compras realizadas
    List<Map<String, Object>> sales = db.queryForList("""
        SELECT s.id, coalesce(s.offline_folio, 'TK-' || substring(s.id::text, 1, 8)) as invoice_number,
               s.total,
               coalesce((SELECT p.payment_method FROM payments p WHERE p.sale_id = s.id LIMIT 1), s.invoice_type) as payment_method,
               s.status, s.created_at,
               t.name as store_name, t.phone as store_phone
        FROM sales s
        JOIN customers c ON c.id = s.customer_id
        JOIN tenants t ON t.id = s.tenant_id
        WHERE c.customer_account_id = ?
           OR c.phone = ?
           OR regexp_replace(c.phone, '[^0-9]', '', 'g') = ?
           OR (? <> '' AND c.identification_number = ?)
        ORDER BY s.created_at DESC LIMIT 20
        """, accountId, cleanPhone, cleanPhone, cleanId, cleanId);

    // 5. Garantías activas
    List<Map<String, Object>> warranties = db.queryForList("""
        SELECT w.id, w.warranty_code, w.starts_at, w.expires_at, w.terms, w.status,
               w.service_description, w.warranty_days, w.created_at,
               t.name as store_name, t.phone as store_phone,
               (w.expires_at > now() AND w.status = 'ACTIVE') as is_active,
               GREATEST(0, EXTRACT(DAY FROM (w.expires_at - now())))::integer as days_remaining
        FROM warranties w
        JOIN customers c ON c.id = w.customer_id
        JOIN tenants t ON t.id = w.tenant_id
        WHERE c.customer_account_id = ?
           OR c.phone = ?
           OR regexp_replace(c.phone, '[^0-9]', '', 'g') = ?
           OR (? <> '' AND c.identification_number = ?)
        ORDER BY w.created_at DESC
        """, accountId, cleanPhone, cleanPhone, cleanId, cleanId);

    List<Map<String, Object>> processedRequests = new ArrayList<>();
    for (Map<String, Object> r : requests) {
      Map<String, Object> copy = new LinkedHashMap<>(r);
      copy.put("bids", parseJson(copy.get("bids")));
      copy.put("images", parseJson(copy.get("images")));
      processedRequests.add(copy);
    }

    List<Map<String, Object>> processedOrders = new ArrayList<>();
    for (Map<String, Object> wo : workOrders) {
      Map<String, Object> copy = new LinkedHashMap<>(wo);
      copy.put("items", parseJson(copy.get("items")));
      copy.put("images", parseJson(copy.get("images")));
      copy.put("intakeChecklist", parseJson(copy.get("intake_checklist")));
      processedOrders.add(copy);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("account", account);
    out.put("requests", processedRequests);
    out.put("workOrders", processedOrders);
    out.put("sales", sales);
    out.put("warranties", warranties);
    return ResponseEntity.ok(out);
  }

  /**
   * Public: Cliente aprueba presupuesto o repuesto adicional en su orden de trabajo desde el portal.
   */
  @PostMapping("/api/public/work-orders/{id}/approve-quote")
  public ResponseEntity<Map<String, Object>> approveWorkOrderQuote(
      @PathVariable String id,
      @RequestBody(required = false) Map<String, Object> body
  ) {
    UUID orderId = id(id);
    List<Map<String, Object>> rows = db.queryForList("SELECT * FROM work_orders WHERE id = ?", orderId);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden de trabajo no encontrada");
    Map<String, Object> order = rows.get(0);

    String clientNotes = body != null && body.get("clientNotes") != null
        ? body.get("clientNotes").toString().trim()
        : "Presupuesto aprobado por el cliente desde el portal digital.";

    db.update("""
        UPDATE work_orders
        SET status = 'APPROVED', approved_at = now(), client_notes = ?, rejection_reason = null, updated_at = now()
        WHERE id = ?
        """,
        clientNotes, orderId
    );

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("message", "¡Presupuesto aprobado con éxito! El taller continuará con la reparación.");
    out.put("orderId", orderId);
    out.put("status", "APPROVED");
    return ResponseEntity.ok(out);
  }

  /**
   * Public: Cliente rechaza presupuesto o repuesto adicional en su orden de trabajo.
   */
  @PostMapping("/api/public/work-orders/{id}/reject-quote")
  public ResponseEntity<Map<String, Object>> rejectWorkOrderQuote(
      @PathVariable String id,
      @RequestBody(required = false) Map<String, Object> body
  ) {
    UUID orderId = id(id);
    List<Map<String, Object>> rows = db.queryForList("SELECT * FROM work_orders WHERE id = ?", orderId);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden de trabajo no encontrada");

    String reason = body != null && body.get("reason") != null
        ? body.get("reason").toString().trim()
        : "Rechazado por el cliente por costo o tiempo.";

    db.update("""
        UPDATE work_orders
        SET status = 'REJECTED', rejection_reason = ?, updated_at = now()
        WHERE id = ?
        """,
        reason, orderId
    );

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("message", "Presupuesto rechazado.");
    out.put("orderId", orderId);
    out.put("status", "REJECTED");
    return ResponseEntity.ok(out);
  }
}

