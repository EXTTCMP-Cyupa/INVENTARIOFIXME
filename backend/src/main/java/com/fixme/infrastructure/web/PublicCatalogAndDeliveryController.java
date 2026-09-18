package com.fixme.infrastructure.web;

import com.fixme.application.SalePort;
import com.fixme.application.SaleService;
import com.fixme.domain.Sale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/public")
public class PublicCatalogAndDeliveryController {

  private final JdbcTemplate db;
  private final SaleService saleService;

  public PublicCatalogAndDeliveryController(JdbcTemplate db, SaleService saleService) {
    this.db = db;
    this.saleService = saleService;
  }

  // =========================================================================
  // 1. PUBLIC DIGITAL CATALOG FOR CLIENTS
  // =========================================================================

  @GetMapping("/catalog/{tenantId}")
  public Map<String, Object> getCatalog(@PathVariable UUID tenantId) {
    // 1. Verify tenant is registered and active
    List<Map<String, Object>> tRows = db.queryForList("""
        SELECT id, name, business_type, phone, billing_contact_phone,
               coalesce(catalog_enabled, true) as catalog_enabled,
               catalog_description, catalog_whatsapp, catalog_banner_url,
               subscription_status
        FROM tenants
        WHERE id = ?
        """, tenantId);

    if (tRows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada");
    }

    Map<String, Object> tenant = tRows.get(0);
    if ("SUSPENDED".equalsIgnoreCase(String.valueOf(tenant.get("subscription_status")))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El catálogo digital de esta tienda no se encuentra disponible temporalmente.");
    }

    // 2. Fetch main branch contact & address
    Map<String, Object> branch = Map.of();
    try {
      branch = db.queryForMap("""
          SELECT id, name, address, phone
          FROM branches
          WHERE tenant_id = ?
          ORDER BY (name = 'Principal') DESC, created_at ASC
          LIMIT 1
          """, tenantId);
    } catch (Exception ignored) {}

    // 3. Fetch product categories for the catalog
    List<Map<String, Object>> categories = db.queryForList("""
        SELECT id, name
        FROM categories
        WHERE tenant_id = ?
        ORDER BY name ASC
        """, tenantId);

    // 4. Fetch available products with active stock
    List<Map<String, Object>> products = db.queryForList("""
        SELECT p.id, p.name, p.sku, p.price, p.category_id,
               c.name as category_name,
               coalesce(sum(ps.stock), 0) as stock
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_stock ps ON ps.product_id = p.id
        WHERE p.tenant_id = ?
        GROUP BY p.id, p.name, p.sku, p.price, p.category_id, c.name
        HAVING coalesce(sum(ps.stock), 0) > 0
        ORDER BY p.name ASC
        """, tenantId);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("tenantId", tenantId);
    response.put("storeName", tenant.get("name"));
    response.put("businessType", tenant.get("business_type"));
    response.put("storePhone", tenant.get("phone") != null ? tenant.get("phone") : tenant.get("billing_contact_phone"));
    response.put("catalogWhatsapp", tenant.get("catalog_whatsapp") != null ? tenant.get("catalog_whatsapp") : tenant.get("phone"));
    response.put("catalogDescription", tenant.get("catalog_description"));
    response.put("catalogBannerUrl", tenant.get("catalog_banner_url"));
    response.put("branch", branch);
    response.put("categories", categories);
    response.put("products", products);
    response.put("totalProducts", products.size());

    return response;
  }

  // =========================================================================
  // 2. PUBLIC ORDER PLACEMENT VIA DIGITAL CATALOG
  // =========================================================================

  @PostMapping("/catalog/{tenantId}/order")
  public ResponseEntity<Map<String, Object>> placeCatalogOrder(
      @PathVariable UUID tenantId,
      @RequestBody Map<String, Object> body
  ) {
    // 1. Verify tenant status
    List<Map<String, Object>> tRows = db.queryForList("""
        SELECT id, name, phone, billing_contact_phone, catalog_whatsapp, subscription_status
        FROM tenants WHERE id = ?
        """, tenantId);

    if (tRows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada");
    }
    Map<String, Object> tenant = tRows.get(0);
    if ("SUSPENDED".equalsIgnoreCase(String.valueOf(tenant.get("subscription_status")))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se pueden procesar pedidos en este momento.");
    }

    // 2. Extract Customer details
    String customerName = String.valueOf(body.getOrDefault("customerName", "Cliente Catálogo Web")).trim();
    String customerPhone = String.valueOf(body.getOrDefault("customerPhone", "")).trim();
    String customerEmail = body.get("customerEmail") != null ? String.valueOf(body.get("customerEmail")).trim() : null;
    String customerAddress = body.get("deliveryAddress") != null ? String.valueOf(body.get("deliveryAddress")).trim() : "";
    String customerIdNumber = body.get("customerIdentification") != null ? String.valueOf(body.get("customerIdentification")).trim() : null;

    if (customerName.isBlank() || customerPhone.isBlank()) {
      throw new IllegalArgumentException("Nombre y teléfono de contacto son obligatorios para realizar el pedido");
    }

    // 3. Find or Create Customer
    UUID customerId = null;
    try {
      customerId = db.queryForObject(
          "SELECT id FROM customers WHERE tenant_id = ? AND (phone = ? OR (email IS NOT NULL AND email = ?)) LIMIT 1",
          UUID.class, tenantId, customerPhone, customerEmail
      );
    } catch (Exception ignored) {}

    if (customerId == null) {
      customerId = UUID.randomUUID();
      db.update(
          "INSERT INTO customers(id, tenant_id, name, phone, email, address, identification_number) VALUES(?, ?, ?, ?, ?, ?, ?)",
          customerId, tenantId, customerName, customerPhone, customerEmail, customerAddress, customerIdNumber
      );
    }

    // 4. Branch & Seller resolution
    UUID branchId = null;
    try {
      branchId = db.queryForObject(
          "SELECT id FROM branches WHERE tenant_id = ? ORDER BY (name = 'Principal') DESC, created_at ASC LIMIT 1",
          UUID.class, tenantId
      );
    } catch (Exception ignored) {
      try {
        branchId = db.queryForObject("SELECT id FROM branches WHERE tenant_id = ? LIMIT 1", UUID.class, tenantId);
      } catch (Exception e2) {
        // Auto-create a default branch if somehow missing
        branchId = UUID.randomUUID();
        db.update("INSERT INTO branches(id, tenant_id, name, address, phone) VALUES(?, ?, 'Principal', 'Tienda Central', '')", branchId, tenantId);
      }
    }

    UUID sellerId = null;
    try {
      sellerId = db.queryForObject(
          "SELECT id FROM app_users WHERE tenant_id = ? AND role IN ('MANAGER', 'SELLER', 'TENANT_ADMIN', 'SUPER_ADMIN') ORDER BY (role = 'MANAGER') DESC, created_at ASC LIMIT 1",
          UUID.class, tenantId
      );
    } catch (Exception ignored) {
      try {
        sellerId = db.queryForObject("SELECT id FROM app_users WHERE tenant_id = ? LIMIT 1", UUID.class, tenantId);
      } catch (Exception e2) {
        // Auto-create a system user for the catalog order
        sellerId = UUID.randomUUID();
        db.update("INSERT INTO app_users(id, tenant_id, email, password_hash, role, full_name) VALUES(?, ?, 'catalogo@fixme.local', 'noop', 'SELLER', 'Ventas Online Catálogo')", sellerId, tenantId);
      }
    }

    // 5. Items extraction & stock verification
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rawItems = (List<Map<String, Object>>) body.get("items");
    if (rawItems == null || rawItems.isEmpty()) {
      throw new IllegalArgumentException("El carrito no contiene productos");
    }

    List<SalePort.Item> saleItems = new ArrayList<>();
    BigDecimal calculatedSubtotal = BigDecimal.ZERO;

    for (Map<String, Object> it : rawItems) {
      UUID pId = UUID.fromString(String.valueOf(it.get("productId")));
      int qty = Integer.parseInt(String.valueOf(it.get("quantity")));
      if (qty <= 0) continue;

      BigDecimal price = db.queryForObject("SELECT price FROM products WHERE id = ? AND tenant_id = ?", BigDecimal.class, pId, tenantId);
      calculatedSubtotal = calculatedSubtotal.add(price.multiply(BigDecimal.valueOf(qty)));
      saleItems.add(new SalePort.Item(pId, qty));
    }

    if (saleItems.isEmpty()) {
      throw new IllegalArgumentException("Debe seleccionar al menos un producto válido");
    }

    // 6. Fulfillment & Shipping cost
    String fulfillmentType = "DELIVERY".equalsIgnoreCase(String.valueOf(body.get("fulfillmentType"))) ? "DELIVERY" : "PICKUP";
    BigDecimal shippingCost = BigDecimal.ZERO;
    if ("DELIVERY".equals(fulfillmentType)) {
      if (body.get("shippingCost") != null && !body.get("shippingCost").toString().isBlank()) {
        try {
          shippingCost = new BigDecimal(body.get("shippingCost").toString());
        } catch (Exception ignored) {}
      }
    }
    BigDecimal grandTotal = calculatedSubtotal.add(shippingCost);

    // 7. Delivery Info
    SalePort.DeliveryInfo deliveryInfo = null;
    if ("DELIVERY".equals(fulfillmentType)) {
      String delAddress = body.get("deliveryAddress") != null ? body.get("deliveryAddress").toString().trim() : customerAddress;
      if (delAddress.isBlank()) {
        throw new IllegalArgumentException("La dirección de entrega es obligatoria para pedidos a domicilio");
      }
      String recipient = body.get("recipientName") != null ? body.get("recipientName").toString() : customerName;
      String recipientPhone = body.get("recipientPhone") != null ? body.get("recipientPhone").toString() : customerPhone;
      String delNotes = body.get("deliveryNotes") != null ? body.get("deliveryNotes").toString() : "Pedido desde Catálogo Digital";

      deliveryInfo = new SalePort.DeliveryInfo(
          recipient,
          recipientPhone,
          delAddress,
          delNotes,
          "Motorizado Express",
          shippingCost
      );
    }

    // 8. Payment Method
    String payMethod = body.get("paymentMethod") != null ? body.get("paymentMethod").toString().toUpperCase(Locale.ROOT) : "CASH";
    if (!Set.of("CASH", "CARD", "TRANSFER", "OTHER").contains(payMethod)) {
      payMethod = "CASH";
    }

    // 9. Execute Sale via SaleService
    Sale sale = saleService.create(
        tenantId,
        branchId,
        sellerId,
        saleItems,
        List.of(new SalePort.Payment(payMethod, grandTotal)),
        customerId,
        30,
        "ONLINE",
        fulfillmentType,
        shippingCost,
        deliveryInfo
    );

    // Look up delivery record created
    String trackingNumber = null;
    UUID deliveryId = null;
    String deliveryStatus = null;
    try {
      var del = db.queryForMap("SELECT id, tracking_number, status FROM deliveries WHERE sale_id = ? AND tenant_id = ?", sale.id(), tenantId);
      deliveryId = (UUID) del.get("id");
      trackingNumber = (String) del.get("tracking_number");
      deliveryStatus = (String) del.get("status");
    } catch (Exception ignored) {}

    // 10. Format WhatsApp Message for the store
    String storeContact = tenant.get("catalog_whatsapp") != null ? tenant.get("catalog_whatsapp").toString() :
                          (tenant.get("phone") != null ? tenant.get("phone").toString() : "");
    String cleanStorePhone = storeContact.replaceAll("[^0-9]", "");

    String orderShortId = sale.id().toString().substring(0, 8).toUpperCase();
    StringBuilder waMsg = new StringBuilder();
    waMsg.append("🛍️ *NUEVO PEDIDO DESDE CATÁLOGO DIGITAL* 🛍️\n");
    waMsg.append("• *Pedido:* #").append(orderShortId).append("\n");
    waMsg.append("• *Cliente:* ").append(customerName).append(" (").append(customerPhone).append(")\n");
    waMsg.append("• *Modalidad:* ").append("DELIVERY".equals(fulfillmentType) ? "🛵 Envío a Domicilio" : "🏬 Retiro en Tienda").append("\n");
    if ("DELIVERY".equals(fulfillmentType)) {
      waMsg.append("• *Dirección:* ").append(customerAddress).append("\n");
      if (trackingNumber != null) {
        waMsg.append("• *Tracking:* ").append(trackingNumber).append("\n");
      }
    }
    waMsg.append("• *Total a Pagar:* $").append(grandTotal.setScale(2, RoundingMode.HALF_UP)).append("\n");
    waMsg.append("• *Método de Pago:* ").append(payMethod).append("\n\n");
    waMsg.append("Por favor confirmar mi pedido. ¡Muchas gracias!");

    String waEncoded = URLEncoder.encode(waMsg.toString(), StandardCharsets.UTF_8);
    String waUrl = !cleanStorePhone.isBlank() ? "https://wa.me/" + cleanStorePhone + "?text=" + waEncoded : "";

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("success", true);
    result.put("orderId", sale.id());
    result.put("saleId", sale.id());
    result.put("orderNumber", orderShortId);
    result.put("total", grandTotal);
    result.put("subtotal", calculatedSubtotal);
    result.put("shippingCost", shippingCost);
    result.put("fulfillmentType", fulfillmentType);
    result.put("deliveryId", deliveryId);
    result.put("trackingNumber", trackingNumber);
    result.put("deliveryStatus", deliveryStatus != null ? deliveryStatus : "PENDING");
    result.put("trackingUrl", trackingNumber != null ? "/#tracking/" + trackingNumber : null);
    result.put("storeName", tenant.get("name"));
    result.put("whatsappUrl", waUrl);
    result.put("whatsappMessage", waMsg.toString());

    return ResponseEntity.status(HttpStatus.CREATED).body(result);
  }

  // =========================================================================
  // 3. PUBLIC LIVE DELIVERY TRACKING FOR CUSTOMERS
  // =========================================================================

  @GetMapping("/deliveries/tracking/{code}")
  public Map<String, Object> getPublicDeliveryTracking(@PathVariable String code) {
    if (code == null || code.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código de seguimiento obligatorio");
    }

    String cleanCode = code.trim();
    String sql = """
        SELECT d.id, d.tenant_id, d.sale_id, d.customer_id, d.branch_id, d.status,
               d.courier, d.address, d.recipient_name, d.recipient_phone, d.delivery_notes,
               d.shipping_cost, d.tracking_number, d.tracking_url, d.driver_id, d.created_at, d.updated_at,
               t.name as store_name, coalesce(t.catalog_whatsapp, t.phone, t.billing_contact_phone) as store_phone,
               s.total as sale_total, s.channel as sale_channel, s.created_at as sale_date,
               drv.name as driver_name, drv.phone as driver_phone, drv.vehicle_type as driver_vehicle, drv.external_company as driver_company
        FROM deliveries d
        JOIN tenants t ON t.id = d.tenant_id
        LEFT JOIN sales s ON s.id = d.sale_id
        LEFT JOIN delivery_drivers drv ON drv.id = d.driver_id
        WHERE d.tracking_number = ? OR d.id::text = ?
        LIMIT 1
        """;

    List<Map<String, Object>> list = db.queryForList(sql, cleanCode, cleanCode);
    if (list.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No encontramos ningún envío con el código " + cleanCode);
    }

    Map<String, Object> d = list.get(0);
    UUID saleId = (UUID) d.get("sale_id");

    // Fetch items of the order
    List<Map<String, Object>> items = List.of();
    if (saleId != null) {
      items = db.queryForList("""
          SELECT si.quantity, si.unit_price, si.line_total, p.name as product_name, p.sku
          FROM sale_items si
          JOIN products p ON p.id = si.product_id
          WHERE si.sale_id = ?
          ORDER BY si.id ASC
          """, saleId);
    }

    String status = String.valueOf(d.get("status")).toUpperCase(Locale.ROOT);
    String statusLabel = switch (status) {
      case "PENDING" -> "En preparación en tienda 📦";
      case "ASSIGNED" -> "Repartidor asignado para recogida 🛵";
      case "IN_TRANSIT" -> "¡En camino hacia tu domicilio! 🚀";
      case "DELIVERED" -> "¡Entregado con éxito! ✅";
      case "CANCELLED" -> "Envío cancelado 🚫";
      default -> status;
    };

    int stepIndex = switch (status) {
      case "PENDING" -> 1;
      case "ASSIGNED" -> 2;
      case "IN_TRANSIT" -> 3;
      case "DELIVERED" -> 4;
      default -> 1;
    };

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("deliveryId", d.get("id"));
    result.put("trackingNumber", d.get("tracking_number"));
    result.put("status", status);
    result.put("statusLabel", statusLabel);
    result.put("stepIndex", stepIndex); // 1 to 4
    result.put("storeName", d.get("store_name"));
    result.put("storePhone", d.get("store_phone"));
    result.put("recipientName", d.get("recipient_name"));
    result.put("recipientPhone", d.get("recipient_phone"));
    result.put("address", d.get("address"));
    result.put("deliveryNotes", d.get("delivery_notes"));
    result.put("shippingCost", d.get("shipping_cost"));
    result.put("courier", d.get("courier"));
    result.put("trackingUrl", d.get("tracking_url")); // live GPS (InDrive / Uber)
    result.put("driverName", d.get("driver_name"));
    result.put("driverPhone", d.get("driver_phone"));
    result.put("driverVehicle", d.get("driver_vehicle"));
    result.put("driverCompany", d.get("driver_company"));
    result.put("saleTotal", d.get("sale_total"));
    result.put("saleChannel", d.get("sale_channel"));
    result.put("createdAt", d.get("created_at"));
    result.put("updatedAt", d.get("updated_at"));
    result.put("items", items);

    return result;
  }
}
