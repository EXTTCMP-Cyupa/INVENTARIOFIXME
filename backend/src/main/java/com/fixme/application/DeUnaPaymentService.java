package com.fixme.application;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class DeUnaPaymentService {

  private final JdbcTemplate db;
  private final QuoteService quoteService;
  private final SecureRandom random = new SecureRandom();

  public DeUnaPaymentService(JdbcTemplate db, QuoteService quoteService) {
    this.db = db;
    this.quoteService = quoteService;
  }

  private void setTenantContext(UUID tenantId) {
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }

  // --- CONFIGURATION ---

  public Map<String, Object> getConfig(UUID tenantId) {
    setTenantContext(tenantId);
    try {
      return db.queryForMap("""
          SELECT id, tenant_id, branch_id, merchant_id, merchant_name,
                 phone_number, api_key, api_secret, environment, enabled, auto_simulate
          FROM deuna_configs WHERE tenant_id = ?
          """, tenantId);
    } catch (EmptyResultDataAccessException e) {
      // Auto create default sandbox config
      String storeName = "FixmeTiendas";
      try {
        storeName = db.queryForObject("SELECT name FROM tenants WHERE id = ?", String.class, tenantId);
      } catch (Exception ignored) {}

      db.update("""
          INSERT INTO deuna_configs(id, tenant_id, merchant_id, merchant_name, phone_number, api_key, api_secret, environment, enabled, auto_simulate)
          VALUES (uuid_generate_v4(), ?, 'DEUNA-DEMO-001', ?, '0999999999', 'sandbox_key_deuna_fixme', 'sandbox_secret_deuna_fixme', 'SANDBOX', true, false)
          ON CONFLICT (tenant_id) DO NOTHING
          """, tenantId, storeName);

      return db.queryForMap("""
          SELECT id, tenant_id, branch_id, merchant_id, merchant_name,
                 phone_number, api_key, api_secret, environment, enabled, auto_simulate
          FROM deuna_configs WHERE tenant_id = ?
          """, tenantId);
    }
  }

  @Transactional
  public Map<String, Object> updateConfig(UUID tenantId, Map<String, Object> req) {
    setTenantContext(tenantId);
    getConfig(tenantId); // Ensure row exists

    String merchantId = (String) req.getOrDefault("merchant_id", req.get("merchantId"));
    String merchantName = (String) req.getOrDefault("merchant_name", req.get("merchantName"));
    String phoneNumber = (String) req.getOrDefault("phone_number", req.get("phoneNumber"));
    String apiKey = (String) req.getOrDefault("api_key", req.get("apiKey"));
    String apiSecret = (String) req.getOrDefault("api_secret", req.get("apiSecret"));
    String environment = (String) req.getOrDefault("environment", "SANDBOX");
    Boolean enabled = (Boolean) req.getOrDefault("enabled", true);
    Boolean autoSimulate = (Boolean) req.getOrDefault("auto_simulate", req.getOrDefault("autoSimulate", false));

    db.update("""
        UPDATE deuna_configs
        SET merchant_id = COALESCE(?, merchant_id),
            merchant_name = COALESCE(?, merchant_name),
            phone_number = COALESCE(?, phone_number),
            api_key = COALESCE(?, api_key),
            api_secret = COALESCE(?, api_secret),
            environment = COALESCE(?, environment),
            enabled = COALESCE(?, enabled),
            auto_simulate = COALESCE(?, auto_simulate),
            updated_at = now()
        WHERE tenant_id = ?
        """, merchantId, merchantName, phoneNumber, apiKey, apiSecret, environment, enabled, autoSimulate, tenantId);

    return getConfig(tenantId);
  }

  // --- QR GENERATION ---

  public record CreateDeUnaQrRequest(
      BigDecimal amount,
      String referenceType, // "POS_SALE", "QUOTE"
      UUID quoteId,
      UUID saleId,
      String customerName,
      String customerPhone
  ) {}

  @Transactional
  public Map<String, Object> createQr(UUID tenantId, UUID branchId, CreateDeUnaQrRequest req) {
    setTenantContext(tenantId);
    Map<String, Object> config = getConfig(tenantId);
    if (Boolean.FALSE.equals(config.get("enabled"))) {
      throw new IllegalStateException("Los pagos con DeUna QR están desactivados para esta tienda");
    }

    BigDecimal amount = req.amount() != null ? req.amount().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    if (amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("El monto a cobrar con DeUna QR debe ser mayor a 0");
    }

    String txCode = "DU-" + (System.currentTimeMillis() % 10000000) + "-" + (1000 + random.nextInt(9000));
    String merchantId = (String) config.getOrDefault("merchant_id", "DEUNA-DEMO-001");
    String merchantName = (String) config.getOrDefault("merchant_name", "FIXMETIENDAS");
    String env = (String) config.getOrDefault("environment", "SANDBOX");

    // Standard Deep link URL
    String deeplinkUrl = String.format("https://deuna.app/pay?id=%s&amount=%.2f&merchant=%s", txCode, amount, merchantId);

    // EMVCo QR Payload for Banco Pichincha / Ecuador Interbank QR
    String emvcoPayload = buildEmvcoPayload(merchantId, merchantName, amount, txCode);

    OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(15);
    String refType = req.referenceType() != null ? req.referenceType() : "POS_SALE";

    db.update("""
        INSERT INTO deuna_transactions (
            id, tenant_id, branch_id, transaction_id, amount, currency, status,
            reference_type, quote_id, sale_id, qr_payload, deeplink_url,
            payer_phone, payer_name, environment, expires_at, created_at, updated_at
        ) VALUES (
            uuid_generate_v4(), ?, ?, ?, ?, 'USD', 'PENDING',
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, now(), now()
        )
        """,
        tenantId, branchId, txCode, amount,
        refType, req.quoteId(), req.saleId(), emvcoPayload, deeplinkUrl,
        req.customerPhone(), req.customerName(), env, expiresAt
    );

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("transactionId", txCode);
    resp.put("amount", amount);
    resp.put("currency", "USD");
    resp.put("status", "PENDING");
    resp.put("qrPayload", emvcoPayload);
    resp.put("deeplinkUrl", deeplinkUrl);
    resp.put("merchantName", merchantName);
    resp.put("environment", env);
    resp.put("expiresAt", expiresAt.toString());
    resp.put("referenceType", refType);

    return resp;
  }

  // --- PUBLIC QUOTE QR GENERATION ---

  @Transactional
  public Map<String, Object> createQrForPublicQuote(String quoteToken) {
    var quoteOpt = quoteService.findByPublicToken(quoteToken);
    if (quoteOpt.isEmpty()) {
      throw new IllegalArgumentException("Cotización no encontrada para el token provisto");
    }
    var quote = quoteOpt.get();
    if ("CONVERTED".equalsIgnoreCase(quote.getStatus())) {
      throw new IllegalStateException("Esta cotización ya fue convertida a venta previamente");
    }

    return createQr(quote.getTenantId(), quote.getBranchId(), new CreateDeUnaQrRequest(
        quote.getTotal(),
        "QUOTE",
        quote.getId(),
        null,
        quote.getCustomerName(),
        quote.getCustomerPhone()
    ));
  }

  // --- STATUS CHECK ---

  public Map<String, Object> checkStatus(String transactionId) {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT id, tenant_id, branch_id, transaction_id, amount, currency, status,
               reference_type, quote_id, sale_id, deeplink_url, payer_phone, payer_name,
               authorization_code, environment, expires_at, paid_at, created_at
        FROM deuna_transactions
        WHERE transaction_id = ?
        """, transactionId);

    if (rows.isEmpty()) {
      throw new IllegalArgumentException("Transacción DeUna no encontrada: " + transactionId);
    }

    Map<String, Object> tx = new HashMap<>(rows.get(0));
    String currentStatus = (String) tx.get("status");
    Object expObj = tx.get("expires_at");
    boolean expired = false;
    if (expObj instanceof OffsetDateTime odt) {
      expired = OffsetDateTime.now().isAfter(odt);
    } else if (expObj instanceof java.sql.Timestamp ts) {
      expired = System.currentTimeMillis() > ts.getTime();
    } else if (expObj instanceof java.time.Instant inst) {
      expired = java.time.Instant.now().isAfter(inst);
    }

    if ("PENDING".equalsIgnoreCase(currentStatus) && expired) {
      db.update("UPDATE deuna_transactions SET status = 'EXPIRED', updated_at = now() WHERE transaction_id = ?", transactionId);
      tx.put("status", "EXPIRED");
    }

    return tx;
  }

  // --- SANDBOX TEST SIMULATION ---

  @Transactional
  public Map<String, Object> simulateSuccess(String transactionId, String simulatedPhone) {
    Map<String, Object> tx = checkStatus(transactionId);
    String currentStatus = (String) tx.get("status");
    if ("APPROVED".equalsIgnoreCase(currentStatus)) {
      return tx;
    }

    String authCode = "AUTH-DEUNA-" + (100000 + random.nextInt(900000));
    String phone = simulatedPhone != null && !simulatedPhone.isBlank() ? simulatedPhone : "09" + (10000000 + random.nextInt(90000000));

    db.update("""
        UPDATE deuna_transactions
        SET status = 'APPROVED',
            authorization_code = ?,
            payer_phone = ?,
            paid_at = now(),
            updated_at = now()
        WHERE transaction_id = ?
        """, authCode, phone, transactionId);

    UUID quoteId = (UUID) tx.get("quote_id");
    UUID tenantId = (UUID) tx.get("tenant_id");

    if (quoteId != null && tenantId != null) {
      try {
        setTenantContext(tenantId);
        quoteService.updateStatus(tenantId, quoteId, "APPROVED");
      } catch (Exception ignored) {}
    }

    return checkStatus(transactionId);
  }

  // --- WEBHOOK HANDLER (BANCO PICHINCHA / DEUNA) ---

  @Transactional
  public Map<String, Object> handleWebhook(Map<String, Object> payload) {
    String txId = (String) payload.getOrDefault("transactionId", payload.get("id"));
    String status = (String) payload.getOrDefault("status", "APPROVED");
    String authCode = (String) payload.getOrDefault("authorizationCode", "AUTH-WH-" + System.currentTimeMillis());
    String phone = (String) payload.getOrDefault("payerPhone", "");

    if (txId == null || txId.isBlank()) {
      return Map.of("error", "transactionId missing in webhook payload");
    }

    db.update("""
        UPDATE deuna_transactions
        SET status = ?,
            authorization_code = COALESCE(?, authorization_code),
            payer_phone = CASE WHEN ? != '' THEN ? ELSE payer_phone END,
            paid_at = CASE WHEN ? = 'APPROVED' THEN now() ELSE paid_at END,
            metadata = ?::jsonb,
            updated_at = now()
        WHERE transaction_id = ?
        """,
        status.toUpperCase(Locale.ROOT),
        authCode,
        phone, phone,
        status.toUpperCase(Locale.ROOT),
        "{ \"webhook\": true }",
        txId
    );

    return Map.of("success", true, "transactionId", txId, "status", status);
  }

  // --- EMVCo ECUADOR QR SPECIFICATION BUILDER ---

  private String buildEmvcoPayload(String merchantId, String merchantName, BigDecimal amount, String txId) {
    StringBuilder sb = new StringBuilder();

    // 00: Payload Format Indicator
    appendEmvcoTag(sb, "00", "01");
    // 01: Point of Initiation Method: 12 = Dynamic QR
    appendEmvcoTag(sb, "01", "12");

    // 26: Merchant Account Information (DeUna Red Interbancaria)
    StringBuilder sub26 = new StringBuilder();
    appendEmvcoTag(sub26, "00", "com.deuna.app");
    appendEmvcoTag(sub26, "01", merchantId);
    appendEmvcoTag(sb, "26", sub26.toString());

    // 52: Merchant Category Code
    appendEmvcoTag(sb, "52", "5411");
    // 53: Transaction Currency (840 = USD)
    appendEmvcoTag(sb, "53", "840");
    // 54: Transaction Amount
    appendEmvcoTag(sb, "54", String.format(Locale.US, "%.2f", amount));
    // 58: Country Code (EC)
    appendEmvcoTag(sb, "58", "EC");
    // 59: Merchant Name
    String safeName = merchantName != null ? merchantName.replaceAll("[^a-zA-Z0-9 ]", "").trim() : "FIXMETIENDAS";
    if (safeName.length() > 25) safeName = safeName.substring(0, 25);
    if (safeName.isEmpty()) safeName = "FIXMETIENDAS";
    appendEmvcoTag(sb, "59", safeName.toUpperCase(Locale.ROOT));
    // 60: Merchant City
    appendEmvcoTag(sb, "60", "QUITO");

    // 62: Additional Data Field (Reference / Bill Number)
    StringBuilder sub62 = new StringBuilder();
    appendEmvcoTag(sub62, "01", txId);
    appendEmvcoTag(sb, "62", sub62.toString());

    // 63: CRC-16 Checksum prefix
    sb.append("6304");
    String crc = calculateCrc16(sb.toString());
    sb.append(crc);

    return sb.toString();
  }

  private void appendEmvcoTag(StringBuilder sb, String tag, String value) {
    if (value == null) value = "";
    sb.append(tag);
    sb.append(String.format("%02d", value.length()));
    sb.append(value);
  }

  public static String calculateCrc16(String input) {
    int crc = 0xFFFF;
    byte[] bytes = input.getBytes(StandardCharsets.US_ASCII);
    for (byte b : bytes) {
      for (int i = 0; i < 8; i++) {
        boolean bit = ((b >> (7 - i) & 1) == 1);
        boolean c15 = ((crc >> 15 & 1) == 1);
        crc <<= 1;
        if (c15 ^ bit) {
          crc ^= 0x1021;
        }
      }
    }
    return String.format("%04X", crc & 0xFFFF);
  }
}

