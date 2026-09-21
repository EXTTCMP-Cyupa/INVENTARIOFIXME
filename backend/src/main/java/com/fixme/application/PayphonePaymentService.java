package com.fixme.application;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class PayphonePaymentService {

  private final JdbcTemplate db;
  private final QuoteService quoteService;
  private final SecureRandom random = new SecureRandom();

  public PayphonePaymentService(JdbcTemplate db, QuoteService quoteService) {
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
          SELECT id, tenant_id, branch_id, token, client_id, store_id,
                 environment, enabled, auto_simulate
          FROM payphone_configs WHERE tenant_id = ?
          """, tenantId);
    } catch (EmptyResultDataAccessException e) {
      db.update("""
          INSERT INTO payphone_configs(id, tenant_id, token, client_id, store_id, environment, enabled, auto_simulate)
          VALUES (uuid_generate_v4(), ?, 'sandbox_payphone_token_fixme', 'PAYPHONE-DEMO-001', 'STORE-DEMO-001', 'SANDBOX', true, false)
          ON CONFLICT (tenant_id) DO NOTHING
          """, tenantId);

      return db.queryForMap("""
          SELECT id, tenant_id, branch_id, token, client_id, store_id,
                 environment, enabled, auto_simulate
          FROM payphone_configs WHERE tenant_id = ?
          """, tenantId);
    }
  }

  @Transactional
  public Map<String, Object> updateConfig(UUID tenantId, Map<String, Object> req) {
    setTenantContext(tenantId);
    getConfig(tenantId); // Ensure row exists

    String token = (String) req.getOrDefault("token", "");
    String clientId = (String) req.getOrDefault("client_id", req.get("clientId"));
    String storeId = (String) req.getOrDefault("store_id", req.get("storeId"));
    String environment = (String) req.getOrDefault("environment", "SANDBOX");
    Boolean enabled = (Boolean) req.getOrDefault("enabled", true);
    Boolean autoSimulate = (Boolean) req.getOrDefault("auto_simulate", req.getOrDefault("autoSimulate", false));

    db.update("""
        UPDATE payphone_configs
        SET token = COALESCE(?, token),
            client_id = COALESCE(?, client_id),
            store_id = COALESCE(?, store_id),
            environment = COALESCE(?, environment),
            enabled = COALESCE(?, enabled),
            auto_simulate = COALESCE(?, auto_simulate),
            updated_at = now()
        WHERE tenant_id = ?
        """, token, clientId, storeId, environment, enabled, autoSimulate, tenantId);

    return getConfig(tenantId);
  }

  // --- PREPARE CARD PAYMENT ---

  public record PreparePayphoneRequest(
      BigDecimal amount,
      BigDecimal tax,
      String referenceType, // "POS_SALE", "QUOTE"
      UUID quoteId,
      UUID saleId,
      String customerEmail,
      String customerPhone
  ) {}

  @Transactional
  public Map<String, Object> preparePayment(UUID tenantId, UUID branchId, PreparePayphoneRequest req) {
    setTenantContext(tenantId);
    Map<String, Object> config = getConfig(tenantId);
    if (Boolean.FALSE.equals(config.get("enabled"))) {
      throw new IllegalStateException("Los pagos con tarjeta Payphone están desactivados para esta tienda");
    }

    BigDecimal amount = req.amount() != null ? req.amount().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    if (amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw new IllegalArgumentException("El monto a cobrar con tarjeta debe ser mayor a 0");
    }

    BigDecimal tax = req.tax() != null ? req.tax().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;

    String clientTxId = "PP-" + (System.currentTimeMillis() % 10000000) + "-" + (1000 + random.nextInt(9000));
    String txId = "TX-PP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    String env = (String) config.getOrDefault("environment", "SANDBOX");

    // Standard Payphone Checkout / Link URL
    String paymentUrl = String.format("https://pay.payphonetodoesposible.com/pay?clientTxId=%s&amount=%.2f", clientTxId, amount);

    OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(20);
    String refType = req.referenceType() != null ? req.referenceType() : "POS_SALE";

    db.update("""
        INSERT INTO payphone_transactions (
            id, tenant_id, branch_id, transaction_id, client_transaction_id,
            amount, tax, currency, status, reference_type, quote_id, sale_id,
            payment_url, payer_email, payer_phone, environment, expires_at, created_at, updated_at
        ) VALUES (
            uuid_generate_v4(), ?, ?, ?, ?,
            ?, ?, 'USD', 'PENDING', ?, ?, ?,
            ?, ?, ?, ?, ?, now(), now()
        )
        """,
        tenantId, branchId, txId, clientTxId,
        amount, tax, refType, req.quoteId(), req.saleId(),
        paymentUrl, req.customerEmail(), req.customerPhone(), env, expiresAt
    );

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("clientTransactionId", clientTxId);
    resp.put("transactionId", txId);
    resp.put("amount", amount);
    resp.put("tax", tax);
    resp.put("currency", "USD");
    resp.put("status", "PENDING");
    resp.put("paymentUrl", paymentUrl);
    resp.put("environment", env);
    resp.put("expiresAt", expiresAt.toString());
    resp.put("referenceType", refType);

    return resp;
  }

  // --- PUBLIC QUOTE PREPARATION ---

  @Transactional
  public Map<String, Object> prepareForPublicQuote(String quoteToken) {
    var quoteOpt = quoteService.findByPublicToken(quoteToken);
    if (quoteOpt.isEmpty()) {
      throw new IllegalArgumentException("Cotización no encontrada para el token provisto");
    }
    var quote = quoteOpt.get();
    if ("CONVERTED".equalsIgnoreCase(quote.getStatus())) {
      throw new IllegalStateException("Esta cotización ya fue convertida a venta previamente");
    }

    return preparePayment(quote.getTenantId(), quote.getBranchId(), new PreparePayphoneRequest(
        quote.getTotal(),
        quote.getTax(),
        "QUOTE",
        quote.getId(),
        null,
        quote.getCustomerEmail(),
        quote.getCustomerPhone()
    ));
  }

  // --- STATUS CHECK ---

  public Map<String, Object> checkStatus(String clientTransactionId) {
    List<Map<String, Object>> rows = db.queryForList("""
        SELECT id, tenant_id, branch_id, transaction_id, client_transaction_id,
               amount, tax, currency, status, reference_type, quote_id, sale_id,
               payment_url, card_brand, card_last_digits, authorization_code,
               payer_email, payer_phone, environment, expires_at, paid_at, created_at
        FROM payphone_transactions
        WHERE client_transaction_id = ? OR transaction_id = ?
        """, clientTransactionId, clientTransactionId);

    if (rows.isEmpty()) {
      throw new IllegalArgumentException("Transacción Payphone no encontrada: " + clientTransactionId);
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
      db.update("UPDATE payphone_transactions SET status = 'EXPIRED', updated_at = now() WHERE client_transaction_id = ?", clientTransactionId);
      tx.put("status", "EXPIRED");
    }

    return tx;
  }

  // --- SANDBOX TEST SIMULATION ---

  @Transactional
  public Map<String, Object> simulateSuccess(String clientTransactionId, String cardBrand, String lastDigits) {
    Map<String, Object> tx = checkStatus(clientTransactionId);
    String currentStatus = (String) tx.get("status");
    if ("APPROVED".equalsIgnoreCase(currentStatus)) {
      return tx;
    }

    String brand = cardBrand != null && !cardBrand.isBlank() ? cardBrand.toUpperCase(Locale.ROOT) : "VISA";
    String digits = lastDigits != null && !lastDigits.isBlank() ? lastDigits : String.valueOf(1000 + random.nextInt(9000));
    String authCode = "AUTH-PP-" + (100000 + random.nextInt(900000));

    db.update("""
        UPDATE payphone_transactions
        SET status = 'APPROVED',
            authorization_code = ?,
            card_brand = ?,
            card_last_digits = ?,
            paid_at = now(),
            updated_at = now()
        WHERE client_transaction_id = ? OR transaction_id = ?
        """, authCode, brand, digits, clientTransactionId, clientTransactionId);

    UUID quoteId = (UUID) tx.get("quote_id");
    UUID tenantId = (UUID) tx.get("tenant_id");

    if (quoteId != null && tenantId != null) {
      try {
        setTenantContext(tenantId);
        quoteService.updateStatus(tenantId, quoteId, "APPROVED");
      } catch (Exception ignored) {}
    }

    return checkStatus(clientTransactionId);
  }

  // --- WEBHOOK CONFIRMATION ---

  @Transactional
  public Map<String, Object> confirmFromWebhook(Map<String, Object> payload) {
    String clientTxId = (String) payload.getOrDefault("clientTransactionId", payload.get("clientTxId"));
    String status = (String) payload.getOrDefault("status", "APPROVED");
    String authCode = (String) payload.getOrDefault("authorizationCode", "AUTH-WH-" + System.currentTimeMillis());
    String cardBrand = (String) payload.getOrDefault("cardBrand", "VISA");
    String cardLastDigits = (String) payload.getOrDefault("cardLastDigits", "4242");

    if (clientTxId == null || clientTxId.isBlank()) {
      return Map.of("error", "clientTransactionId missing in webhook payload");
    }

    db.update("""
        UPDATE payphone_transactions
        SET status = ?,
            authorization_code = COALESCE(?, authorization_code),
            card_brand = COALESCE(?, card_brand),
            card_last_digits = COALESCE(?, card_last_digits),
            paid_at = CASE WHEN ? = 'APPROVED' THEN now() ELSE paid_at END,
            metadata = ?::jsonb,
            updated_at = now()
        WHERE client_transaction_id = ? OR transaction_id = ?
        """,
        status.toUpperCase(Locale.ROOT),
        authCode,
        cardBrand,
        cardLastDigits,
        status.toUpperCase(Locale.ROOT),
        "{ \"webhook\": true }",
        clientTxId, clientTxId
    );

    return Map.of("success", true, "clientTransactionId", clientTxId, "status", status);
  }
}

