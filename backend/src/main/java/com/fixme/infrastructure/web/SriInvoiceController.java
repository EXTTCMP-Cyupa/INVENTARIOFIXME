package com.fixme.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixme.infrastructure.sri.SriAccessKeyGenerator;
import com.fixme.infrastructure.sri.SriSoapClient;
import com.fixme.infrastructure.sri.SriXmlBuilder;
import com.fixme.infrastructure.sri.SriXmlSigner;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/sri")
public class SriInvoiceController {

  private final JdbcTemplate db;
  private final ObjectMapper mapper = new ObjectMapper();

  public SriInvoiceController(JdbcTemplate db) {
    this.db = db;
  }

  private UUID tenant(Jwt jwt) {
    String t = jwt.getClaimAsString("tenant_id");
    if (t != null && !t.isBlank()) return UUID.fromString(t);
    return UUID.fromString("00000000-0000-0000-0000-000000000001");
  }

  private void ctx(UUID tenantId) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, tenantId.toString());
  }

  // 1. GET SRI CONFIGURATION
  @GetMapping("/config")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> getConfig(@AuthenticationPrincipal Jwt jwt) {
    UUID t = tenant(jwt);
    ctx(t);

    List<Map<String, Object>> rows = db.queryForList("""
        SELECT id, tenant_id, ruc, razon_social, nombre_comercial,
               direccion_matriz, direccion_establecimiento,
               codigo_establecimiento, codigo_punto_emision,
               obligado_contabilidad, contribuyente_especial_num,
               regimen_tributario, agente_retencion_num,
               ambiente_sri, secuencial_factura, secuencial_nota_credito,
               certificado_caducidad, certificado_nombre_archivo,
               (certificado_p12_base64 IS NOT NULL AND LENGTH(certificado_p12_base64) > 10) AS tiene_certificado,
               enabled, created_at, updated_at
        FROM tenant_sri_config
        WHERE tenant_id = ?
        """, t);

    if (rows.isEmpty()) {
      // Return defaults from tenant
      var tenant = db.queryForMap("SELECT id, name, billing_contact_phone FROM tenants WHERE id = ?", t);
      Map<String, Object> def = new LinkedHashMap<>();
      def.put("ruc", "1790012345001");
      def.put("razonSocial", tenant.get("name") != null ? tenant.get("name") : "FixmeTiendas S.A.S.");
      def.put("nombreComercial", tenant.get("name"));
      def.put("direccionMatriz", "Av. Principal y Central");
      def.put("direccionEstablecimiento", "Av. Principal Local 1");
      def.put("codigoEstablecimiento", "001");
      def.put("codigoPuntoEmision", "001");
      def.put("obligadoContabilidad", false);
      def.put("regimenTributario", "RIMPE_EMPRENDEDOR");
      def.put("ambienteSri", 1);
      def.put("secuencialFactura", 1);
      def.put("tieneCertificado", false);
      def.put("enabled", true);
      return def;
    }

    Map<String, Object> r = new LinkedHashMap<>(rows.get(0));
    // camelCase aliases
    r.put("razonSocial", r.get("razon_social"));
    r.put("nombreComercial", r.get("nombre_comercial"));
    r.put("direccionMatriz", r.get("direccion_matriz"));
    r.put("direccionEstablecimiento", r.get("direccion_establecimiento"));
    r.put("codigoEstablecimiento", r.get("codigo_establecimiento"));
    r.put("codigoPuntoEmision", r.get("codigo_punto_emision"));
    r.put("obligadoContabilidad", r.get("obligado_contabilidad"));
    r.put("regimenTributario", r.get("regimen_tributario"));
    r.put("ambienteSri", r.get("ambiente_sri"));
    r.put("secuencialFactura", r.get("secuencial_factura"));
    r.put("tieneCertificado", r.get("tiene_certificado"));
    return r;
  }

  // 2. SAVE SRI CONFIGURATION
  @PostMapping("/config")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> saveConfig(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> body) {
    UUID t = tenant(jwt);
    ctx(t);

    String ruc = String.valueOf(body.getOrDefault("ruc", "1790012345001")).trim();
    String razonSocial = String.valueOf(body.getOrDefault("razonSocial", "FixmeTiendas S.A.S.")).trim();
    String nombreComercial = String.valueOf(body.getOrDefault("nombreComercial", razonSocial)).trim();
    String dirMatriz = String.valueOf(body.getOrDefault("direccionMatriz", "Matriz Central")).trim();
    String dirEstablecimiento = String.valueOf(body.getOrDefault("direccionEstablecimiento", dirMatriz)).trim();
    String codEstab = String.format("%03d", Integer.parseInt(String.valueOf(body.getOrDefault("codigoEstablecimiento", "1")).replaceAll("[^0-9]", "")));
    String codPtoEmi = String.format("%03d", Integer.parseInt(String.valueOf(body.getOrDefault("codigoPuntoEmision", "1")).replaceAll("[^0-9]", "")));
    boolean obligado = Boolean.parseBoolean(String.valueOf(body.getOrDefault("obligadoContabilidad", false)));
    String regimen = String.valueOf(body.getOrDefault("regimenTributario", "RIMPE_EMPRENDEDOR")).trim();
    int ambiente = Integer.parseInt(String.valueOf(body.getOrDefault("ambienteSri", 1)));
    int secuencial = Integer.parseInt(String.valueOf(body.getOrDefault("secuencialFactura", 1)));

    String p12Base64 = body.get("certificadoP12Base64") != null ? String.valueOf(body.get("certificadoP12Base64")).trim() : null;
    String p12Pass = body.get("certificadoP12Password") != null ? String.valueOf(body.get("certificadoP12Password")).trim() : null;
    String p12FileName = body.get("certificadoNombreArchivo") != null ? String.valueOf(body.get("certificadoNombreArchivo")).trim() : null;

    db.update("""
        INSERT INTO tenant_sri_config (
            tenant_id, ruc, razon_social, nombre_comercial, direccion_matriz, direccion_establecimiento,
            codigo_establecimiento, codigo_punto_emision, obligado_contabilidad, regimen_tributario,
            ambiente_sri, secuencial_factura,
            certificado_p12_base64, certificado_p12_password, certificado_nombre_archivo,
            enabled, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, now())
        ON CONFLICT (tenant_id) DO UPDATE SET
            ruc = EXCLUDED.ruc,
            razon_social = EXCLUDED.razon_social,
            nombre_comercial = EXCLUDED.nombre_comercial,
            direccion_matriz = EXCLUDED.direccion_matriz,
            direccion_establecimiento = EXCLUDED.direccion_establecimiento,
            codigo_establecimiento = EXCLUDED.codigo_establecimiento,
            codigo_punto_emision = EXCLUDED.codigo_punto_emision,
            obligado_contabilidad = EXCLUDED.obligado_contabilidad,
            regimen_tributario = EXCLUDED.regimen_tributario,
            ambiente_sri = EXCLUDED.ambiente_sri,
            secuencial_factura = GREATEST(tenant_sri_config.secuencial_factura, EXCLUDED.secuencial_factura),
            certificado_p12_base64 = COALESCE(NULLIF(EXCLUDED.certificado_p12_base64, ''), tenant_sri_config.certificado_p12_base64),
            certificado_p12_password = COALESCE(NULLIF(EXCLUDED.certificado_p12_password, ''), tenant_sri_config.certificado_p12_password),
            certificado_nombre_archivo = COALESCE(NULLIF(EXCLUDED.certificado_nombre_archivo, ''), tenant_sri_config.certificado_nombre_archivo),
            updated_at = now()
        """,
        t, ruc, razonSocial, nombreComercial, dirMatriz, dirEstablecimiento,
        codEstab, codPtoEmi, obligado, regimen, ambiente, secuencial,
        p12Base64, p12Pass, p12FileName
    );

    return getConfig(jwt);
  }

  // 3. ISSUE OFFICIAL SRI ELECTRONIC INVOICE (E.g. from existing Sale or direct)
  @PostMapping("/invoices/from-sale/{saleId}")
  @PreAuthorize("hasAnyAuthority('SCOPE_TENANT_ADMIN','SCOPE_MANAGER','SCOPE_SELLER','SCOPE_SUPER_ADMIN')")
  public Map<String, Object> issueInvoiceFromSale(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID saleId,
      @RequestBody(required = false) Map<String, Object> customerOverrides
  ) {
    UUID t = tenant(jwt);
    ctx(t);

    // 1. Fetch sale
    List<Map<String, Object>> sales = db.queryForList("""
        SELECT s.id, s.tenant_id, s.subtotal, COALESCE(s.discount, 0.00) AS discount, s.tax, s.total, s.created_at, s.customer_id,
               c.name AS customer_name, c.identification_type, c.identification_number,
               c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.id = ? AND s.tenant_id = ?
        """, saleId, t);

    if (sales.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Venta no encontrada");
    }
    Map<String, Object> sale = sales.get(0);

    // Check if already has active electronic invoice
    List<Map<String, Object>> existingInvoices = db.queryForList("""
        SELECT id, numero_completo, clave_acceso, estado_sri, fecha_autorizacion
        FROM electronic_invoices
        WHERE sale_id = ? AND tenant_id = ? AND estado_sri = 'AUTORIZADA'
        """, saleId, t);
    if (!existingInvoices.isEmpty()) {
      return getInvoiceDetail(jwt, (UUID) existingInvoices.get(0).get("id"));
    }

    // 2. Fetch SRI Config
    Map<String, Object> config = getConfig(jwt);
    String ruc = String.valueOf(config.get("ruc"));
    String razonSocial = String.valueOf(config.get("razonSocial"));
    String nombreComercial = String.valueOf(config.getOrDefault("nombreComercial", razonSocial));
    String dirMatriz = String.valueOf(config.getOrDefault("direccionMatriz", "Matriz"));
    String dirEstab = String.valueOf(config.getOrDefault("direccionEstablecimiento", dirMatriz));
    String estab = String.valueOf(config.getOrDefault("codigoEstablecimiento", "001"));
    String ptoEmi = String.valueOf(config.getOrDefault("codigoPuntoEmision", "001"));
    boolean obligado = Boolean.parseBoolean(String.valueOf(config.getOrDefault("obligadoContabilidad", false)));
    String regimen = String.valueOf(config.getOrDefault("regimenTributario", "GENERAL"));
    int ambiente = Integer.parseInt(String.valueOf(config.getOrDefault("ambienteSri", 1)));

    // Sequential resolution
    Integer currentSeq = db.queryForObject("SELECT secuencial_factura FROM tenant_sri_config WHERE tenant_id = ?", Integer.class, t);
    if (currentSeq == null) currentSeq = 1;
    String seqFormatted = String.format("%09d", currentSeq);
    String numCompleto = String.format("%03d-%03d-%09d", Integer.parseInt(estab), Integer.parseInt(ptoEmi), currentSeq);

    // 3. Resolve Customer details
    String buyerName = sale.get("customer_name") != null ? sale.get("customer_name").toString() : "CONSUMIDOR FINAL";
    String buyerId = sale.get("identification_number") != null ? sale.get("identification_number").toString().trim() : "9999999999999";
    String buyerType = "07"; // default Consumidor Final
    String buyerPhone = sale.get("customer_phone") != null ? sale.get("customer_phone").toString() : "";
    String buyerEmail = sale.get("customer_email") != null ? sale.get("customer_email").toString() : "";
    String buyerAddress = sale.get("customer_address") != null ? sale.get("customer_address").toString() : "";

    if (customerOverrides != null) {
      if (customerOverrides.get("identificationNumber") != null && !customerOverrides.get("identificationNumber").toString().isBlank()) {
        buyerId = customerOverrides.get("identificationNumber").toString().trim();
      }
      if (customerOverrides.get("name") != null && !customerOverrides.get("name").toString().isBlank()) {
        buyerName = customerOverrides.get("name").toString().trim();
      }
      if (customerOverrides.get("phone") != null) buyerPhone = customerOverrides.get("phone").toString().trim();
      if (customerOverrides.get("email") != null) buyerEmail = customerOverrides.get("email").toString().trim();
      if (customerOverrides.get("address") != null) buyerAddress = customerOverrides.get("address").toString().trim();
    }

    if (buyerId.length() == 13) {
      buyerType = "04"; // RUC
    } else if (buyerId.length() == 10 && !buyerId.equals("9999999999")) {
      buyerType = "05"; // Cedula
    } else if (buyerId.equalsIgnoreCase("9999999999999") || buyerId.isBlank()) {
      buyerType = "07";
      buyerId = "9999999999999";
      buyerName = "CONSUMIDOR FINAL";
    }

    // 4. Fetch Sale Items
    List<Map<String, Object>> saleItems = db.queryForList("""
        SELECT si.quantity, si.unit_price, si.line_total, p.name AS product_name, p.sku
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
        """, saleId);

    List<SriXmlBuilder.ItemDetail> items = new ArrayList<>();
    BigDecimal subtotalSinImpuestos = BigDecimal.ZERO;
    BigDecimal subtotal15 = BigDecimal.ZERO;
    BigDecimal iva15Total = BigDecimal.ZERO;

    for (Map<String, Object> si : saleItems) {
      BigDecimal qty = new BigDecimal(si.get("quantity").toString());
      BigDecimal unitPrice = new BigDecimal(si.get("unit_price").toString());
      BigDecimal lineTotal = qty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
      
      // In Ecuador current standard rate is 15% IVA
      BigDecimal itemIva = lineTotal.multiply(BigDecimal.valueOf(0.15)).setScale(2, RoundingMode.HALF_UP);
      subtotalSinImpuestos = subtotalSinImpuestos.add(lineTotal);
      subtotal15 = subtotal15.add(lineTotal);
      iva15Total = iva15Total.add(itemIva);

      items.add(new SriXmlBuilder.ItemDetail(
          si.get("sku") != null ? si.get("sku").toString() : "PROD-" + items.size(),
          si.get("product_name").toString(),
          qty,
          unitPrice,
          BigDecimal.ZERO,
          lineTotal,
          true
      ));
    }

    BigDecimal totalDiscount = sale.get("discount") != null ? new BigDecimal(sale.get("discount").toString()) : BigDecimal.ZERO;
    BigDecimal subtotalSinImpuestosNeto = subtotalSinImpuestos.subtract(totalDiscount).max(BigDecimal.ZERO);
    BigDecimal subtotal15Neto = subtotal15.subtract(totalDiscount).max(BigDecimal.ZERO);
    BigDecimal iva15TotalNeto = subtotal15Neto.multiply(BigDecimal.valueOf(0.15)).setScale(2, RoundingMode.HALF_UP);
    BigDecimal grandTotal = subtotalSinImpuestosNeto.add(iva15TotalNeto);

    // 5. Generate 49-digit Access Key
    LocalDate today = LocalDate.now();
    String accessKey = SriAccessKeyGenerator.generate(
        today,
        "01",
        ruc,
        ambiente,
        estab,
        ptoEmi,
        seqFormatted,
        null
    );

    // 6. Build XML
    SriXmlBuilder.InvoiceData data = new SriXmlBuilder.InvoiceData(
        accessKey,
        ambiente,
        ruc,
        razonSocial,
        nombreComercial,
        dirMatriz,
        dirEstab,
        estab,
        ptoEmi,
        seqFormatted,
        obligado,
        regimen,
        null,
        null,
        today,
        buyerType,
        buyerId,
        buyerName,
        buyerAddress,
        buyerPhone,
        buyerEmail,
        subtotalSinImpuestosNeto,
        subtotal15Neto,
        BigDecimal.ZERO,
        iva15TotalNeto,
        totalDiscount,
        grandTotal,
        "01", // 01: Sin utilizacion del sistema financiero / Efectivo
        items,
        Map.of("TicketOrigen", "#" + saleId.toString().substring(0, 8).toUpperCase())
    );

    String rawXml = SriXmlBuilder.buildFacturaXml(data);

    // 7. Sign XML
    String p12Base64 = db.queryForObject("SELECT certificado_p12_base64 FROM tenant_sri_config WHERE tenant_id = ?", String.class, t);
    String p12Pass = db.queryForObject("SELECT certificado_p12_password FROM tenant_sri_config WHERE tenant_id = ?", String.class, t);
    String signedXml = SriXmlSigner.signXml(rawXml, p12Base64, p12Pass);

    // 8. Submit to SRI / Web Service
    SriSoapClient.SriResponse sriResp = SriSoapClient.processInvoice(signedXml, accessKey, ambiente);

    // 9. Persist in electronic_invoices
    UUID invoiceId = UUID.randomUUID();
    String mensajesJson = "[]";
    try {
      mensajesJson = mapper.writeValueAsString(sriResp.messages());
    } catch (Exception ignored) {}

    db.update("""
        INSERT INTO electronic_invoices (
            id, tenant_id, sale_id, tipo_documento, establecimiento, punto_emision, secuencial, numero_completo,
            clave_acceso, fecha_emision, ambiente,
            cliente_tipo_id, cliente_identificacion, cliente_razon_social, cliente_direccion, cliente_telefono, cliente_email,
            subtotal_sin_impuestos, subtotal_15, subtotal_0, iva_15, total_descuento, importe_total, forma_pago_sri,
            estado_sri, numero_autorizacion, fecha_autorizacion, mensajes_sri, xml_generado, xml_firmado
        ) VALUES (
            ?, ?, ?, '01', ?, ?, ?, ?,
            ?, now(), ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, 0.00, ?, 0.00, ?, '01',
            ?, ?, ?, ?::jsonb, ?, ?
        )
        """,
        invoiceId, t, saleId, estab, ptoEmi, seqFormatted, numCompleto,
        accessKey, ambiente,
        buyerType, buyerId, buyerName, buyerAddress, buyerPhone, buyerEmail,
        subtotalSinImpuestos, subtotal15, iva15Total, grandTotal,
        sriResp.status(), sriResp.authorizationNumber(), sriResp.authorizationDate(),
        mensajesJson, rawXml, signedXml
    );

    // Update sale record
    db.update("""
        UPDATE sales SET
            invoice_type = 'SRI_INVOICE',
            electronic_invoice_id = ?
        WHERE id = ? AND tenant_id = ?
        """, invoiceId, saleId, t);

    // Increment tenant sequential
    db.update("UPDATE tenant_sri_config SET secuencial_factura = secuencial_factura + 1, updated_at = now() WHERE tenant_id = ?", t);

    return getInvoiceDetail(jwt, invoiceId);
  }

  // 4. GET ELECTRONIC INVOICE DETAIL (For RIDE view & print)
  @GetMapping("/invoices/{id}")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> getInvoiceDetail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    UUID t = tenant(jwt);
    ctx(t);

    List<Map<String, Object>> list = db.queryForList("""
        SELECT ei.*,
               tsc.ruc AS emisor_ruc,
               tsc.razon_social AS emisor_razon_social,
               tsc.nombre_comercial AS emisor_nombre_comercial,
               tsc.direccion_matriz AS emisor_direccion_matriz,
               tsc.direccion_establecimiento AS emisor_direccion_estab,
               tsc.regimen_tributario AS emisor_regimen,
               tsc.obligado_contabilidad AS emisor_obligado
        FROM electronic_invoices ei
        JOIN tenant_sri_config tsc ON tsc.tenant_id = ei.tenant_id
        WHERE ei.id = ? AND ei.tenant_id = ?
        """, id, t);

    if (list.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Factura electrónica no encontrada");
    }

    Map<String, Object> inv = new LinkedHashMap<>(list.get(0));

    // Fetch items
    UUID saleId = (UUID) inv.get("sale_id");
    List<Map<String, Object>> items = List.of();
    if (saleId != null) {
      items = db.queryForList("""
          SELECT si.quantity, si.unit_price, si.line_total, p.name AS product_name, p.sku
          FROM sale_items si
          JOIN products p ON p.id = si.product_id
          WHERE si.sale_id = ?
          ORDER BY si.id ASC
          """, saleId);
    }
    inv.put("items", items);

    return inv;
  }

  // 5. DOWNLOAD SIGNED XML
  @GetMapping(value = "/invoices/{id}/xml", produces = MediaType.APPLICATION_XML_VALUE)
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<String> getInvoiceXml(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    UUID t = tenant(jwt);
    ctx(t);

    List<Map<String, Object>> list = db.queryForList(
        "SELECT numero_completo, xml_firmado, xml_generado FROM electronic_invoices WHERE id = ? AND tenant_id = ?",
        id, t
    );
    if (list.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Factura no encontrada");
    }

    String xml = list.get(0).get("xml_firmado") != null
        ? list.get(0).get("xml_firmado").toString()
        : String.valueOf(list.get(0).get("xml_generado"));

    String num = String.valueOf(list.get(0).get("numero_completo"));

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"factura-" + num + ".xml\"")
        .contentType(MediaType.APPLICATION_XML)
        .body(xml);
  }

  // 6. LIST ELECTRONIC INVOICES
  @GetMapping("/invoices")
  @PreAuthorize("isAuthenticated()")
  public List<Map<String, Object>> listInvoices(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) String status
  ) {
    UUID t = tenant(jwt);
    ctx(t);

    String sql = """
        SELECT id, sale_id, numero_completo, clave_acceso, fecha_emision,
               cliente_identificacion, cliente_razon_social,
               subtotal_sin_impuestos, iva_15, importe_total,
               estado_sri, numero_autorizacion, fecha_autorizacion, created_at
        FROM electronic_invoices
        WHERE tenant_id = ?
        """ + (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status) ? " AND estado_sri = ? " : "") + """
        ORDER BY created_at DESC
        """;

    return (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
        ? db.queryForList(sql, t, status)
        : db.queryForList(sql, t);
  }
}

