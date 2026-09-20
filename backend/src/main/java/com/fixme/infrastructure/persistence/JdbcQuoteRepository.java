package com.fixme.infrastructure.persistence;

import com.fixme.application.QuotePort;
import com.fixme.domain.Quote;
import com.fixme.domain.QuoteItem;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcQuoteRepository implements QuotePort {
  private final JdbcTemplate db;

  public JdbcQuoteRepository(JdbcTemplate db) {
    this.db = db;
  }

  private void setTenantContext(UUID tenantId) {
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }

  private static final RowMapper<Quote> QUOTE_MAPPER = (rs, rowNum) -> new Quote(
      rs.getObject("id", UUID.class),
      rs.getObject("tenant_id", UUID.class),
      rs.getObject("branch_id", UUID.class),
      rs.getObject("user_id", UUID.class),
      rs.getObject("customer_id", UUID.class),
      rs.getString("quote_number"),
      rs.getString("customer_name"),
      rs.getString("customer_phone"),
      rs.getString("customer_email"),
      rs.getString("customer_id_number"),
      rs.getBigDecimal("subtotal"),
      rs.getBigDecimal("discount"),
      rs.getBigDecimal("tax"),
      rs.getBigDecimal("total"),
      rs.getString("status"),
      rs.getObject("valid_until", OffsetDateTime.class),
      rs.getString("notes"),
      rs.getString("terms"),
      rs.getString("public_token"),
      rs.getObject("converted_sale_id", UUID.class),
      rs.getObject("converted_at", OffsetDateTime.class),
      rs.getObject("created_at", OffsetDateTime.class),
      rs.getObject("updated_at", OffsetDateTime.class)
  );

  private static final RowMapper<QuoteItem> ITEM_MAPPER = (rs, rowNum) -> new QuoteItem(
      rs.getObject("id", UUID.class),
      rs.getObject("tenant_id", UUID.class),
      rs.getObject("quote_id", UUID.class),
      rs.getObject("product_id", UUID.class),
      rs.getString("item_type"),
      rs.getString("description"),
      rs.getBigDecimal("quantity"),
      rs.getBigDecimal("unit_price"),
      rs.getBigDecimal("discount"),
      rs.getBigDecimal("tax_rate"),
      rs.getBigDecimal("line_total"),
      rs.getObject("created_at", OffsetDateTime.class)
  );

  @Override
  public Quote save(Quote q) {
    setTenantContext(q.getTenantId());
    String sql = """
        INSERT INTO quotes (
            id, tenant_id, branch_id, user_id, customer_id, quote_number,
            customer_name, customer_phone, customer_email, customer_id_number,
            subtotal, discount, tax, total, status, valid_until, notes, terms,
            public_token, converted_sale_id, converted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

    db.update(sql,
        q.getId(), q.getTenantId(), q.getBranchId(), q.getUserId(), q.getCustomerId(),
        q.getQuoteNumber(), q.getCustomerName(), q.getCustomerPhone(), q.getCustomerEmail(), q.getCustomerIdNumber(),
        q.getSubtotal(), q.getDiscount(), q.getTax(), q.getTotal(), q.getStatus(), q.getValidUntil(),
        q.getNotes(), q.getTerms(), q.getPublicToken(), q.getConvertedSaleId(), q.getConvertedAt(),
        q.getCreatedAt(), q.getUpdatedAt()
    );

    if (q.getItems() != null && !q.getItems().isEmpty()) {
      saveItems(q.getTenantId(), q.getId(), q.getItems());
    }

    return q;
  }

  @Override
  public void update(Quote q) {
    setTenantContext(q.getTenantId());
    String sql = """
        UPDATE quotes SET
            customer_id = ?, customer_name = ?, customer_phone = ?, customer_email = ?,
            customer_id_number = ?, subtotal = ?, discount = ?, tax = ?, total = ?,
            status = ?, valid_until = ?, notes = ?, terms = ?,
            converted_sale_id = ?, converted_at = ?, updated_at = now()
        WHERE tenant_id = ? AND id = ?
        """;

    db.update(sql,
        q.getCustomerId(), q.getCustomerName(), q.getCustomerPhone(), q.getCustomerEmail(),
        q.getCustomerIdNumber(), q.getSubtotal(), q.getDiscount(), q.getTax(), q.getTotal(),
        q.getStatus(), q.getValidUntil(), q.getNotes(), q.getTerms(),
        q.getConvertedSaleId(), q.getConvertedAt(),
        q.getTenantId(), q.getId()
    );
  }

  @Override
  public Optional<Quote> findById(UUID tenantId, UUID quoteId) {
    setTenantContext(tenantId);
    try {
      Quote q = db.queryForObject(
          "SELECT * FROM quotes WHERE tenant_id = ? AND id = ?",
          QUOTE_MAPPER, tenantId, quoteId
      );
      if (q != null) {
        q.setItems(findItemsByQuoteId(tenantId, quoteId));
      }
      return Optional.ofNullable(q);
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  @Override
  public Optional<Quote> findByPublicToken(String token) {
    if (token == null || token.isBlank()) return Optional.empty();
    try {
      List<Quote> list = db.query(
          "SELECT * FROM quotes WHERE public_token = ? OR id::text = ? OR lower(quote_number) = lower(?)",
          QUOTE_MAPPER, token, token, token
      );
      if (list.isEmpty()) return Optional.empty();
      Quote q = list.get(0);
      q.setItems(findItemsByQuoteId(q.getTenantId(), q.getId()));
      return Optional.of(q);
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  @Override
  public List<Map<String, Object>> listEnriched(UUID tenantId, UUID branchId, String status, String search) {
    setTenantContext(tenantId);
    StringBuilder sql = new StringBuilder("""
        SELECT q.id, q.tenant_id, q.branch_id, q.user_id, q.customer_id, q.quote_number,
               q.customer_name, q.customer_phone, q.customer_email, q.customer_id_number,
               q.subtotal, q.discount, q.tax, q.total, q.status, q.valid_until,
               q.notes, q.terms, q.public_token, q.converted_sale_id, q.converted_at,
               q.created_at, q.updated_at,
               b.name AS branch_name,
               u.full_name AS user_name,
               c.name AS registered_customer_name
        FROM quotes q
        LEFT JOIN branches b ON b.id = q.branch_id
        LEFT JOIN app_users u ON u.id = q.user_id
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(tenantId);

    if (branchId != null) {
      sql.append(" AND q.branch_id = ?");
      params.add(branchId);
    }

    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      sql.append(" AND q.status = ?");
      params.add(status.toUpperCase());
    }

    if (search != null && !search.isBlank()) {
      sql.append(" AND (lower(q.quote_number) LIKE ? OR lower(coalesce(q.customer_name,'')) LIKE ? OR lower(coalesce(q.customer_id_number,'')) LIKE ?)");
      String p = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
      params.add(p);
      params.add(p);
      params.add(p);
    }

    sql.append(" ORDER BY q.created_at DESC");
    List<Map<String, Object>> list = db.queryForList(sql.toString(), params.toArray());

    for (Map<String, Object> row : list) {
      UUID qId = row.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("id")));
      List<QuoteItem> items = findItemsByQuoteId(tenantId, qId);
      List<Map<String, Object>> itemsList = items.stream().map(i -> Map.<String, Object>of(
          "id", i.getId(),
          "productId", i.getProductId() != null ? i.getProductId() : "",
          "itemType", i.getItemType(),
          "description", i.getDescription(),
          "quantity", i.getQuantity(),
          "unitPrice", i.getUnitPrice(),
          "discount", i.getDiscount(),
          "taxRate", i.getTaxRate(),
          "lineTotal", i.getLineTotal()
      )).toList();
      row.put("items", itemsList);
    }

    return list;
  }

  @Override
  public String generateNextQuoteNumber(UUID tenantId) {
    setTenantContext(tenantId);
    Integer count = db.queryForObject(
        "SELECT count(*) FROM quotes WHERE tenant_id = ?",
        Integer.class, tenantId
    );
    int next = (count == null ? 0 : count) + 1001;
    return "COT-" + next;
  }

  @Override
  public List<QuoteItem> findItemsByQuoteId(UUID tenantId, UUID quoteId) {
    setTenantContext(tenantId);
    return db.query(
        "SELECT * FROM quote_items WHERE tenant_id = ? AND quote_id = ? ORDER BY created_at ASC",
        ITEM_MAPPER, tenantId, quoteId
    );
  }

  @Override
  public void saveItems(UUID tenantId, UUID quoteId, List<QuoteItem> items) {
    setTenantContext(tenantId);
    db.update("DELETE FROM quote_items WHERE tenant_id = ? AND quote_id = ?", tenantId, quoteId);
    String sql = """
        INSERT INTO quote_items (
            id, tenant_id, quote_id, product_id, item_type, description,
            quantity, unit_price, discount, tax_rate, line_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
    for (QuoteItem it : items) {
      db.update(sql,
          it.getId() != null ? it.getId() : UUID.randomUUID(),
          tenantId,
          quoteId,
          it.getProductId(),
          it.getItemType(),
          it.getDescription(),
          it.getQuantity(),
          it.getUnitPrice(),
          it.getDiscount(),
          it.getTaxRate(),
          it.getLineTotal(),
          it.getCreatedAt()
      );
    }
  }
}

