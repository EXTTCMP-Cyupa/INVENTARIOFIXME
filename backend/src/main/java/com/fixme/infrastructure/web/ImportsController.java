package com.fixme.infrastructure.web;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController
public class ImportsController {
  private final JdbcTemplate db;

  public ImportsController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    return UUID.fromString(jwt.getClaimAsString("tenant_id"));
  }

  private void context(UUID tenant) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenant.toString());
  }

  // ==========================================
  // 1. GESTIÓN DE ENVÍOS INTERNACIONALES (SHIPMENTS)
  // ==========================================

  @GetMapping("/api/imports/shipments")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> listShipments(@AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    return db.queryForList("""
        SELECT
          s.*,
          COUNT(ii.id) AS items_count,
          COALESCE(SUM(ii.quantity), 0) AS total_units,
          COALESCE(SUM(ii.reserved_quantity), 0) AS total_reserved
        FROM international_shipments s
        LEFT JOIN import_items ii ON ii.shipment_id = s.id
        WHERE s.tenant_id = ?
        GROUP BY s.id
        ORDER BY s.created_at DESC
        """, tenant);
  }

  @GetMapping("/api/imports/shipments/{id}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> getShipmentDetail(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);

    Map<String, Object> shipment = db.queryForMap("""
        SELECT * FROM international_shipments WHERE id = ? AND tenant_id = ?
        """, id, tenant);

    List<Map<String, Object>> items = db.queryForList("""
        SELECT
          ii.*,
          c.name AS category_name
        FROM import_items ii
        LEFT JOIN categories c ON c.id = ii.target_category_id
        WHERE ii.shipment_id = ? AND ii.tenant_id = ?
        ORDER BY ii.created_at ASC
        """, id, tenant);

    List<Map<String, Object>> reservations = db.queryForList("""
        SELECT
          ir.*,
          ii.product_name, ii.sku, ii.preorder_price, ii.regular_price
        FROM import_item_reservations ir
        JOIN import_items ii ON ii.id = ir.item_id
        WHERE ii.shipment_id = ? AND ir.tenant_id = ?
        ORDER BY ir.created_at DESC
        """, id, tenant);

    Map<String, Object> res = new HashMap<>(shipment);
    res.put("items", items);
    res.put("reservations", reservations);
    return res;
  }

  public record CreateShipmentInput(
      String trackingNumber,
      String courierName,
      String originStore,
      String title,
      String stage,
      String notes,
      BigDecimal weightLbs,
      BigDecimal originCost,
      BigDecimal freightCost,
      BigDecimal customsCost,
      BigDecimal estimatedFreightCost,
      BigDecimal actualFreightCost,
      BigDecimal estimatedCustomsCost,
      BigDecimal actualCustomsCost,
      String estimatedArrivalDate,
      // Optional integrated item fields
      String productName,
      String sku,
      Integer quantity,
      BigDecimal preorderPrice,
      BigDecimal regularPrice,
      String imageUrl,
      UUID targetCategoryId,
      Boolean isPublicCatalog
  ) {}

  @PostMapping("/api/imports/shipments")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  @Transactional
  public Map<String, Object> createShipment(@AuthenticationPrincipal Jwt jwt, @RequestBody CreateShipmentInput in) {
    String title = in.title() != null ? in.title().trim() : "";
    if (title.isBlank()) throw new IllegalArgumentException("El título del lote/envío es obligatorio");

    String tracking = in.trackingNumber() != null ? in.trackingNumber().trim() : "S/N";
    UUID tenant = tenant(jwt);
    context(tenant);
    UUID id = UUID.randomUUID();

    BigDecimal originCost = in.originCost() != null ? in.originCost() : BigDecimal.ZERO;
    BigDecimal estFreight = in.estimatedFreightCost() != null ? in.estimatedFreightCost()
        : (in.freightCost() != null ? in.freightCost() : BigDecimal.ZERO);
    BigDecimal estCustoms = in.estimatedCustomsCost() != null ? in.estimatedCustomsCost()
        : (in.customsCost() != null ? in.customsCost() : BigDecimal.ZERO);
    BigDecimal actFreight = in.actualFreightCost();
    BigDecimal actCustoms = in.actualCustomsCost();

    BigDecimal effFreight = actFreight != null ? actFreight : estFreight;
    BigDecimal effCustoms = actCustoms != null ? actCustoms : estCustoms;
    BigDecimal totalLanded = originCost.add(effFreight).add(effCustoms);

    String stage = (in.stage() != null && !in.stage().isBlank()) ? in.stage().toUpperCase() : "PURCHASED";

    db.update("""
        INSERT INTO international_shipments (
          id, tenant_id, tracking_number, courier_name, origin_store, title,
          stage, notes, weight_lbs, origin_cost, freight_cost, customs_cost,
          estimated_freight_cost, actual_freight_cost, estimated_customs_cost, actual_customs_cost,
          total_landed_cost, estimated_arrival_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::date)
        """,
        id, tenant, tracking, in.courierName(), in.originStore(), title,
        stage, in.notes(), in.weightLbs() != null ? in.weightLbs() : BigDecimal.ZERO,
        originCost, effFreight, effCustoms,
        estFreight, actFreight, estCustoms, actCustoms,
        totalLanded, in.estimatedArrivalDate()
    );

    // Create item inside shipment so shipment is NEVER empty
    String prodName = (in.productName() != null && !in.productName().isBlank()) ? in.productName().trim() : title;
    int qty = in.quantity() != null && in.quantity() > 0 ? in.quantity() : 1;
    BigDecimal qtyBd = BigDecimal.valueOf(qty);
    BigDecimal unitOrig = originCost.divide(qtyBd, 2, RoundingMode.HALF_UP);
    BigDecimal unitFreight = effFreight.divide(qtyBd, 2, RoundingMode.HALF_UP);
    BigDecimal unitCustoms = effCustoms.divide(qtyBd, 2, RoundingMode.HALF_UP);
    BigDecimal unitLanded = unitOrig.add(unitFreight).add(unitCustoms);

    BigDecimal preorderPrice = in.preorderPrice() != null ? in.preorderPrice() : BigDecimal.ZERO;
    BigDecimal regularPrice = in.regularPrice() != null ? in.regularPrice() : BigDecimal.ZERO;
    boolean isPublic = in.isPublicCatalog() != null ? in.isPublicCatalog() : true;

    db.update("""
        INSERT INTO import_items (
          id, tenant_id, shipment_id, product_name, sku, quantity,
          unit_origin_cost, unit_freight_cost, unit_customs_cost, unit_landed_cost,
          preorder_price, regular_price, image_url, target_category_id, is_public_catalog
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        UUID.randomUUID(), tenant, id, prodName, in.sku(), qty,
        unitOrig, unitFreight, unitCustoms, unitLanded,
        preorderPrice, regularPrice, in.imageUrl(), in.targetCategoryId(), isPublic
    );

    return getShipmentDetail(id, jwt);
  }

  @PutMapping("/api/imports/shipments/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  @Transactional
  public Map<String, Object> updateShipment(
      @PathVariable UUID id,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody CreateShipmentInput in
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    BigDecimal originCost = in.originCost() != null ? in.originCost() : BigDecimal.ZERO;
    BigDecimal estFreight = in.estimatedFreightCost() != null ? in.estimatedFreightCost()
        : (in.freightCost() != null ? in.freightCost() : BigDecimal.ZERO);
    BigDecimal estCustoms = in.estimatedCustomsCost() != null ? in.estimatedCustomsCost()
        : (in.customsCost() != null ? in.customsCost() : BigDecimal.ZERO);
    BigDecimal actFreight = in.actualFreightCost();
    BigDecimal actCustoms = in.actualCustomsCost();

    BigDecimal effFreight = actFreight != null ? actFreight : estFreight;
    BigDecimal effCustoms = actCustoms != null ? actCustoms : estCustoms;
    BigDecimal totalLanded = originCost.add(effFreight).add(effCustoms);

    db.update("""
        UPDATE international_shipments
        SET tracking_number = ?, courier_name = ?, origin_store = ?, title = ?,
            stage = COALESCE(?, stage), notes = ?, weight_lbs = ?,
            origin_cost = ?, freight_cost = ?, customs_cost = ?,
            estimated_freight_cost = ?, actual_freight_cost = ?,
            estimated_customs_cost = ?, actual_customs_cost = ?,
            total_landed_cost = ?,
            estimated_arrival_date = ?::date, updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        in.trackingNumber(), in.courierName(), in.originStore(), in.title(),
        in.stage(), in.notes(), in.weightLbs(),
        originCost, effFreight, effCustoms,
        estFreight, actFreight, estCustoms, actCustoms,
        totalLanded, in.estimatedArrivalDate(), id, tenant
    );

    // Recalculate item unit costs
    recalculateItemCosts(id, tenant, effFreight, effCustoms);

    return getShipmentDetail(id, jwt);
  }

  private void recalculateItemCosts(UUID shipmentId, UUID tenant, BigDecimal effFreight, BigDecimal effCustoms) {
    List<Map<String, Object>> items = db.queryForList(
        "SELECT id, quantity, unit_origin_cost FROM import_items WHERE shipment_id = ? AND tenant_id = ?",
        shipmentId, tenant
    );
    if (items.isEmpty()) return;

    int totalUnits = items.stream().mapToInt(it -> ((Number) it.get("quantity")).intValue()).sum();
    if (totalUnits <= 0) totalUnits = 1;
    BigDecimal totalUnitsBd = BigDecimal.valueOf(totalUnits);

    BigDecimal unitFreight = effFreight.divide(totalUnitsBd, 2, RoundingMode.HALF_UP);
    BigDecimal unitCustoms = effCustoms.divide(totalUnitsBd, 2, RoundingMode.HALF_UP);

    for (Map<String, Object> it : items) {
      UUID itemId = (UUID) it.get("id");
      BigDecimal orig = it.get("unit_origin_cost") != null ? (BigDecimal) it.get("unit_origin_cost") : BigDecimal.ZERO;
      BigDecimal landed = orig.add(unitFreight).add(unitCustoms);
      db.update("""
          UPDATE import_items
          SET unit_freight_cost = ?, unit_customs_cost = ?, unit_landed_cost = ?
          WHERE id = ? AND tenant_id = ?
          """, unitFreight, unitCustoms, landed, itemId, tenant);
    }
  }

  @PatchMapping("/api/imports/shipments/{id}/stage")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  @Transactional
  public Map<String, Object> updateShipmentStage(
      @PathVariable UUID id,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, Object> body
  ) {
    String newStage = body.get("stage") != null ? body.get("stage").toString().trim().toUpperCase() : null;
    if (newStage == null || newStage.isBlank()) {
      throw new IllegalArgumentException("La etapa es obligatoria");
    }

    UUID tenant = tenant(jwt);
    context(tenant);

    Map<String, Object> shipment = db.queryForMap(
        "SELECT * FROM international_shipments WHERE id = ? AND tenant_id = ?", id, tenant
    );

    // Update actual freight if provided
    BigDecimal actFreight = null;
    if (body.get("actualFreightCost") != null && !body.get("actualFreightCost").toString().isBlank()) {
      actFreight = new BigDecimal(body.get("actualFreightCost").toString());
    }

    // Update actual customs if provided
    BigDecimal actCustoms = null;
    if (body.get("actualCustomsCost") != null && !body.get("actualCustomsCost").toString().isBlank()) {
      actCustoms = new BigDecimal(body.get("actualCustomsCost").toString());
    }

    BigDecimal curOrigin = shipment.get("origin_cost") != null ? (BigDecimal) shipment.get("origin_cost") : BigDecimal.ZERO;
    BigDecimal curFreight = actFreight != null ? actFreight
        : (shipment.get("freight_cost") != null ? (BigDecimal) shipment.get("freight_cost") : BigDecimal.ZERO);
    BigDecimal curCustoms = actCustoms != null ? actCustoms
        : (shipment.get("customs_cost") != null ? (BigDecimal) shipment.get("customs_cost") : BigDecimal.ZERO);
    BigDecimal newTotalLanded = curOrigin.add(curFreight).add(curCustoms);

    db.update("""
        UPDATE international_shipments
        SET stage = ?,
            actual_arrival_date = CASE WHEN ? = 'ARRIVED_LOCAL' THEN CURRENT_DATE ELSE actual_arrival_date END,
            freight_cost = ?,
            customs_cost = ?,
            actual_freight_cost = COALESCE(?, actual_freight_cost),
            actual_customs_cost = COALESCE(?, actual_customs_cost),
            total_landed_cost = ?,
            updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        newStage, newStage, curFreight, curCustoms, actFreight, actCustoms, newTotalLanded, id, tenant
    );

    // Recalculate item unit costs with the confirmed freight/customs
    recalculateItemCosts(id, tenant, curFreight, curCustoms);

    // If shipment has arrived locally, transfer or update products in inventory
    boolean importToInventory = body.get("importToInventory") != null
        ? Boolean.parseBoolean(body.get("importToInventory").toString())
        : true;

    if ("ARRIVED_LOCAL".equals(newStage) && importToInventory) {
      List<Map<String, Object>> items = db.queryForList(
          "SELECT * FROM import_items WHERE shipment_id = ? AND tenant_id = ?", id, tenant
      );

      // If shipment had no items yet, auto-create one from shipment metadata
      if (items.isEmpty()) {
        UUID fallbackItemId = UUID.randomUUID();
        String fallbackTitle = (String) shipment.get("title");
        UUID targetCat = body.get("targetCategoryId") != null && !body.get("targetCategoryId").toString().isBlank()
            ? UUID.fromString(body.get("targetCategoryId").toString()) : null;
        BigDecimal regularP = body.get("regularPrice") != null && !body.get("regularPrice").toString().isBlank()
            ? new BigDecimal(body.get("regularPrice").toString()) : newTotalLanded.multiply(new BigDecimal("1.30"));

        db.update("""
            INSERT INTO import_items (
              id, tenant_id, shipment_id, product_name, sku, quantity,
              unit_origin_cost, unit_freight_cost, unit_customs_cost, unit_landed_cost,
              preorder_price, regular_price, target_category_id, is_public_catalog
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, true)
            """,
            fallbackItemId, tenant, id, fallbackTitle, "IMP-" + (1000 + (int)(Math.random() * 9000)),
            curOrigin, curFreight, curCustoms, newTotalLanded, regularP, regularP, targetCat
        );
        items = db.queryForList("SELECT * FROM import_items WHERE shipment_id = ? AND tenant_id = ?", id, tenant);
      }

      // Find primary branch
      UUID branchId = null;
      try {
        branchId = db.queryForObject(
            "SELECT id FROM branches WHERE tenant_id = ? ORDER BY (name = 'Principal') DESC, created_at ASC LIMIT 1",
            UUID.class, tenant
        );
      } catch (Exception ignored) {
        branchId = UUID.randomUUID();
        db.update("INSERT INTO branches(id, tenant_id, name, address, phone) VALUES(?, ?, 'Principal', 'Tienda Central', '')", branchId, tenant);
      }

      // Transfer each item into products and product_stock
      for (Map<String, Object> it : items) {
        String sku = (String) it.get("sku");
        String name = (String) it.get("product_name");
        int qty = ((Number) it.get("quantity")).intValue();
        BigDecimal price = it.get("regular_price") != null && ((BigDecimal) it.get("regular_price")).compareTo(BigDecimal.ZERO) > 0
            ? (BigDecimal) it.get("regular_price")
            : (it.get("preorder_price") != null ? (BigDecimal) it.get("preorder_price") : BigDecimal.ZERO);
        if (price.compareTo(BigDecimal.ZERO) <= 0 && body.get("regularPrice") != null && !body.get("regularPrice").toString().isBlank()) {
          price = new BigDecimal(body.get("regularPrice").toString());
        }
        BigDecimal cost = it.get("unit_landed_cost") != null ? (BigDecimal) it.get("unit_landed_cost") : BigDecimal.ZERO;
        String img = (String) it.get("image_url");

        UUID catId = (UUID) it.get("target_category_id");
        if (catId == null && body.get("targetCategoryId") != null && !body.get("targetCategoryId").toString().isBlank()) {
          catId = UUID.fromString(body.get("targetCategoryId").toString());
        }

        UUID productId;
        List<UUID> existing = sku != null && !sku.isBlank()
            ? db.queryForList("SELECT id FROM products WHERE sku = ? AND tenant_id = ?", UUID.class, sku, tenant)
            : Collections.emptyList();

        if (!existing.isEmpty()) {
          productId = existing.get(0);
          db.update("""
              UPDATE products
              SET stock = stock + ?,
                  purchase_price = ?,
                  price = CASE WHEN price = 0 THEN ? ELSE price END,
                  category_id = COALESCE(?, category_id),
                  image_url = COALESCE(image_url, ?),
                  updated_at = now()
              WHERE id = ? AND tenant_id = ?
              """, qty, cost, price, catId, img, productId, tenant);
        } else {
          productId = UUID.randomUUID();
          String finalSku = (sku != null && !sku.isBlank()) ? sku : ("IMP-" + (1000 + (int)(Math.random() * 9000)));
          db.update("""
              INSERT INTO products (id, tenant_id, sku, name, stock, purchase_price, price, image_url, category_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              """,
              productId, tenant, finalSku, name, qty, cost, price, img, catId
          );
        }

        // Link product_id in import_items
        db.update("UPDATE import_items SET product_id = ? WHERE id = ? AND tenant_id = ?", productId, it.get("id"), tenant);

        // Update branch inventory stock in product_stock
        db.update("""
            INSERT INTO product_stock (product_id, branch_id, stock)
            VALUES (?, ?, ?)
            ON CONFLICT (product_id, branch_id)
            DO UPDATE SET stock = product_stock.stock + EXCLUDED.stock
            """, productId, branchId, qty);

        // Register Kardex inventory movement
        String movementReason = "Ingreso por Importación: " + String.valueOf(shipment.getOrDefault("tracking_number", shipment.get("title")));
        db.update("""
            INSERT INTO inventory_movements (tenant_id, branch_id, product_id, type, quantity, reason, reference_id, reference_type, unit_cost)
            VALUES (?, ?, ?, 'IN', ?, ?, ?, 'IMPORT', ?)
            """, tenant, branchId, productId, qty, movementReason, id, cost);
      }
    }

    return getShipmentDetail(id, jwt);
  }

  @DeleteMapping("/api/imports/shipments/{id}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> deleteShipment(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    db.update("DELETE FROM international_shipments WHERE id = ? AND tenant_id = ?", id, tenant);
    return Map.of("ok", true, "id", id.toString());
  }

  // ==========================================
  // 2. PRODUCTOS DENTRO DEL LOTE (IMPORT ITEMS)
  // ==========================================

  public record ImportItemInput(
      String productName,
      String sku,
      Integer quantity,
      BigDecimal unitOriginCost,
      BigDecimal unitFreightCost,
      BigDecimal unitCustomsCost,
      BigDecimal preorderPrice,
      BigDecimal regularPrice,
      String imageUrl,
      UUID targetCategoryId,
      Boolean isPublicCatalog
  ) {}

  @PostMapping("/api/imports/shipments/{shipmentId}/items")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> addItemToShipment(
      @PathVariable UUID shipmentId,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody ImportItemInput in
  ) {
    String name = in.productName() != null ? in.productName().trim() : "";
    if (name.isBlank()) throw new IllegalArgumentException("El nombre del producto es obligatorio");

    UUID tenant = tenant(jwt);
    context(tenant);
    UUID itemId = UUID.randomUUID();

    BigDecimal orig = in.unitOriginCost() != null ? in.unitOriginCost() : BigDecimal.ZERO;
    BigDecimal freight = in.unitFreightCost() != null ? in.unitFreightCost() : BigDecimal.ZERO;
    BigDecimal customs = in.unitCustomsCost() != null ? in.unitCustomsCost() : BigDecimal.ZERO;
    BigDecimal landed = orig.add(freight).add(customs);

    db.update("""
        INSERT INTO import_items (
          id, tenant_id, shipment_id, product_name, sku, quantity,
          unit_origin_cost, unit_freight_cost, unit_customs_cost, unit_landed_cost,
          preorder_price, regular_price, image_url, target_category_id, is_public_catalog
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        itemId, tenant, shipmentId, name, in.sku(),
        in.quantity() != null && in.quantity() > 0 ? in.quantity() : 1,
        orig, freight, customs, landed,
        in.preorderPrice() != null ? in.preorderPrice() : BigDecimal.ZERO,
        in.regularPrice() != null ? in.regularPrice() : BigDecimal.ZERO,
        in.imageUrl(), in.targetCategoryId(),
        in.isPublicCatalog() != null ? in.isPublicCatalog() : true
    );

    return getShipmentDetail(shipmentId, jwt);
  }

  @DeleteMapping("/api/imports/items/{itemId}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> deleteImportItem(@PathVariable UUID itemId, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    db.update("DELETE FROM import_items WHERE id = ? AND tenant_id = ?", itemId, tenant);
    return Map.of("ok", true, "id", itemId.toString());
  }

  // ==========================================
  // 3. COTIZACIONES DE IMPORTACIÓN A PEDIDO (CLIENT QUOTES)
  // ==========================================

  @GetMapping("/api/imports/quotes")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> listImportQuotes(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) String status
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    String sql = """
        SELECT * FROM import_quotes
        WHERE tenant_id = ?
        """ + (status != null && !status.isBlank() ? " AND status = '" + status.toUpperCase() + "'" : "") +
        " ORDER BY created_at DESC";

    return db.queryForList(sql, tenant);
  }

  public record UpdateImportQuoteInput(
      String status,
      BigDecimal estimatedOriginPrice,
      BigDecimal estimatedShippingFee,
      BigDecimal estimatedCustomsFee,
      BigDecimal totalQuotedPrice,
      Integer estimatedDeliveryDays,
      String sellerNotes
  ) {}

  @PutMapping("/api/imports/quotes/{quoteId}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> updateImportQuote(
      @PathVariable UUID quoteId,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody UpdateImportQuoteInput in
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);

    BigDecimal orig = in.estimatedOriginPrice() != null ? in.estimatedOriginPrice() : BigDecimal.ZERO;
    BigDecimal ship = in.estimatedShippingFee() != null ? in.estimatedShippingFee() : BigDecimal.ZERO;
    BigDecimal cust = in.estimatedCustomsFee() != null ? in.estimatedCustomsFee() : BigDecimal.ZERO;
    BigDecimal total = in.totalQuotedPrice() != null ? in.totalQuotedPrice() : orig.add(ship).add(cust);

    db.update("""
        UPDATE import_quotes
        SET status = COALESCE(?, status),
            estimated_origin_price = ?,
            estimated_shipping_fee = ?,
            estimated_customs_fee = ?,
            total_quoted_price = ?,
            estimated_delivery_days = COALESCE(?, estimated_delivery_days),
            seller_notes = ?,
            updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """,
        in.status(), orig, ship, cust, total, in.estimatedDeliveryDays(), in.sellerNotes(),
        quoteId, tenant
    );

    return db.queryForMap("SELECT * FROM import_quotes WHERE id = ? AND tenant_id = ?", quoteId, tenant);
  }

  // ==========================================
  // 4. ENDPOINTS PÚBLICOS (CLIENTE EXTERNO)
  // ==========================================

  public record PublicQuoteRequestInput(
      UUID tenantId,
      String customerName,
      String customerPhone,
      String customerEmail,
      String productDescription,
      String productUrl,
      Integer quantity
  ) {}

  @PostMapping("/api/public/imports/quotes")
  public ResponseEntity<Map<String, Object>> requestPublicQuote(@RequestBody PublicQuoteRequestInput in) {
    if (in.tenantId() == null) throw new IllegalArgumentException("El tenantId es obligatorio");
    if (in.customerName() == null || in.customerName().isBlank()) throw new IllegalArgumentException("Tu nombre es obligatorio");
    if (in.customerPhone() == null || in.customerPhone().isBlank()) throw new IllegalArgumentException("Tu teléfono es obligatorio");
    if (in.productDescription() == null || in.productDescription().isBlank()) throw new IllegalArgumentException("La descripción del producto es obligatoria");

    UUID quoteId = UUID.randomUUID();
    context(in.tenantId());

    db.update("""
        INSERT INTO import_quotes (
          id, tenant_id, customer_name, customer_phone, customer_email,
          product_description, product_url, quantity, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        """,
        quoteId, in.tenantId(), in.customerName().trim(), in.customerPhone().trim(),
        in.customerEmail(), in.productDescription().trim(), in.productUrl(),
        in.quantity() != null && in.quantity() > 0 ? in.quantity() : 1
    );

    return ResponseEntity.ok(Map.of(
        "id", quoteId.toString(),
        "status", "PENDING",
        "message", "Tu cotización ha sido recibida con éxito. Te responderemos vía WhatsApp en breve."
    ));
  }

  @GetMapping("/api/public/imports/arriving/{tenantId}")
  public List<Map<String, Object>> listPublicArrivingProducts(@PathVariable UUID tenantId) {
    context(tenantId);
    return db.queryForList("""
        SELECT
          ii.id, ii.product_name, ii.sku, ii.quantity, ii.reserved_quantity,
          (ii.quantity - ii.reserved_quantity) AS available_preorder,
          COALESCE(NULLIF(ii.preorder_price, 0), ii.regular_price, 0) AS preorder_price,
          ii.regular_price, ii.image_url,
          s.stage, s.courier_name, s.estimated_arrival_date,
          c.name AS category_name
        FROM import_items ii
        JOIN international_shipments s ON s.id = ii.shipment_id
        LEFT JOIN categories c ON c.id = ii.target_category_id
        WHERE ii.tenant_id = ?
          AND ii.is_public_catalog = true
          AND s.stage IN ('IN_TRANSIT', 'CUSTOMS')
          AND (ii.quantity - ii.reserved_quantity) > 0
        ORDER BY s.estimated_arrival_date ASC NULLS LAST, ii.created_at DESC
        """, tenantId);
  }

  // ==========================================
  // 5. RESERVAS / PRE-COMPRAS DE CLIENTES
  // ==========================================

  public record CreateReservationInput(
      String customerName,
      String customerPhone,
      Integer quantity,
      BigDecimal depositAmount,
      String notes
  ) {}

  @PostMapping("/api/imports/items/{itemId}/reservations")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  @Transactional
  public Map<String, Object> addReservation(
      @PathVariable UUID itemId,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody CreateReservationInput in
  ) {
    if (in.customerName() == null || in.customerName().isBlank()) throw new IllegalArgumentException("Nombre del cliente obligatorio");
    if (in.customerPhone() == null || in.customerPhone().isBlank()) throw new IllegalArgumentException("Teléfono obligatorio");
    int qty = in.quantity() != null && in.quantity() > 0 ? in.quantity() : 1;

    UUID tenant = tenant(jwt);
    context(tenant);
    UUID resId = UUID.randomUUID();

    db.update("""
        INSERT INTO import_item_reservations (
          id, tenant_id, item_id, customer_name, customer_phone, quantity, deposit_amount, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        resId, tenant, itemId, in.customerName().trim(), in.customerPhone().trim(),
        qty, in.depositAmount() != null ? in.depositAmount() : BigDecimal.ZERO, in.notes()
    );

    // Increment reserved_quantity in import_items
    db.update("UPDATE import_items SET reserved_quantity = reserved_quantity + ? WHERE id = ? AND tenant_id = ?",
        qty, itemId, tenant);

    return db.queryForMap("SELECT * FROM import_item_reservations WHERE id = ? AND tenant_id = ?", resId, tenant);
  }

  @PatchMapping("/api/imports/reservations/{resId}/notified")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN','SCOPE_SELLER')")
  public Map<String, Object> markReservationNotified(
      @PathVariable UUID resId,
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody Map<String, String> body
  ) {
    UUID tenant = tenant(jwt);
    context(tenant);
    String type = body.getOrDefault("type", "TRANSIT").toUpperCase();
    if ("ARRIVAL".equals(type)) {
      db.update("UPDATE import_item_reservations SET notified_arrival = true WHERE id = ? AND tenant_id = ?", resId, tenant);
    } else {
      db.update("UPDATE import_item_reservations SET notified_transit = true WHERE id = ? AND tenant_id = ?", resId, tenant);
    }
    return db.queryForMap("SELECT * FROM import_item_reservations WHERE id = ? AND tenant_id = ?", resId, tenant);
  }

  @DeleteMapping("/api/imports/reservations/{resId}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  @Transactional
  public Map<String, Object> deleteReservation(@PathVariable UUID resId, @AuthenticationPrincipal Jwt jwt) {
    UUID tenant = tenant(jwt);
    context(tenant);
    var res = db.queryForMap("SELECT item_id, quantity FROM import_item_reservations WHERE id = ? AND tenant_id = ?", resId, tenant);
    UUID itemId = (UUID) res.get("item_id");
    int qty = ((Number) res.get("quantity")).intValue();

    db.update("DELETE FROM import_item_reservations WHERE id = ? AND tenant_id = ?", resId, tenant);
    db.update("UPDATE import_items SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE id = ? AND tenant_id = ?",
        qty, itemId, tenant);
    return Map.of("ok", true);
  }
}
