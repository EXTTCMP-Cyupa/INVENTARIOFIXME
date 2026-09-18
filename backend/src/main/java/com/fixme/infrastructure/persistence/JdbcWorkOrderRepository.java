package com.fixme.infrastructure.persistence;

import com.fixme.application.WorkOrderPort;
import com.fixme.domain.WorkOrder;
import com.fixme.domain.WorkOrderItem;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcWorkOrderRepository implements WorkOrderPort {
  private final JdbcTemplate db;

  public JdbcWorkOrderRepository(JdbcTemplate db) {
    this.db = db;
  }

  private void setTenantContext(UUID tenantId) {
    db.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }

  private final RowMapper<WorkOrder> mapper = (rs, rowNum) -> mapRow(rs);

  private WorkOrder mapRow(ResultSet rs) throws SQLException {
    return new WorkOrder(
        rs.getObject("id", UUID.class),
        rs.getObject("tenant_id", UUID.class),
        rs.getObject("customer_id", UUID.class),
        rs.getObject("branch_id", UUID.class),
        rs.getString("order_number"),
        rs.getString("device_brand"),
        rs.getString("device_model"),
        rs.getString("serial_number"),
        rs.getString("reported_fault"),
        rs.getString("accessories"),
        rs.getString("description"),
        rs.getString("diagnosis"),
        rs.getBigDecimal("quote"),
        rs.getString("status"),
        rs.getString("approval_token_hash"),
        rs.getObject("approval_expires_at", OffsetDateTime.class),
        rs.getObject("approved_at", OffsetDateTime.class),
        rs.getString("approval_url"),
        rs.getString("technician_notes"),
        rs.getString("client_notes"),
        rs.getString("rejection_reason"),
        rs.getObject("estimated_delivery", OffsetDateTime.class),
        rs.getObject("created_at", OffsetDateTime.class),
        rs.getObject("updated_at", OffsetDateTime.class)
    );
  }

  private final RowMapper<WorkOrderItem> itemMapper = (rs, rowNum) -> {
    OffsetDateTime dt = null;
    try {
      dt = rs.getObject("created_at", OffsetDateTime.class);
    } catch (Exception ignored) {
      java.sql.Timestamp ts = rs.getTimestamp("created_at");
      if (ts != null) dt = ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
    }
    return new WorkOrderItem(
        (UUID) rs.getObject("id"),
        (UUID) rs.getObject("tenant_id"),
        (UUID) rs.getObject("work_order_id"),
        rs.getString("item_type"),
        rs.getString("name"),
        rs.getBigDecimal("quantity"),
        rs.getBigDecimal("unit_price"),
        rs.getBigDecimal("subtotal"),
        dt
    );
  };

  @Override
  public WorkOrder save(WorkOrder w) {
    setTenantContext(w.getTenantId());
    String sql = """
        INSERT INTO work_orders (
          id, tenant_id, customer_id, branch_id, order_number,
          device_brand, device_model, serial_number, reported_fault, accessories,
          description, diagnosis, quote, status, approval_token_hash,
          approval_expires_at, approved_at, approval_url, technician_notes,
          client_notes, rejection_reason, estimated_delivery, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
    db.update(sql,
        w.getId(), w.getTenantId(), w.getCustomerId(), w.getBranchId(), w.getOrderNumber(),
        w.getDeviceBrand(), w.getDeviceModel(), w.getSerialNumber(), w.getReportedFault(), w.getAccessories(),
        w.getDescription(), w.getDiagnosis(), w.getQuote(), w.getStatus(), w.getApprovalTokenHash(),
        w.getApprovalExpiresAt(), w.getApprovedAt(), w.getApprovalUrl(), w.getTechnicianNotes(),
        w.getClientNotes(), w.getRejectionReason(), w.getEstimatedDelivery(), w.getCreatedAt(), w.getUpdatedAt()
    );

    if (w.getItems() != null && !w.getItems().isEmpty()) {
      saveItems(w.getTenantId(), w.getId(), w.getItems());
    }

    return w;
  }

  @Override
  public void update(WorkOrder w) {
    setTenantContext(w.getTenantId());
    String sql = """
        UPDATE work_orders SET
          order_number = ?, device_brand = ?, device_model = ?, serial_number = ?,
          reported_fault = ?, accessories = ?, description = ?, diagnosis = ?,
          quote = ?, status = ?, approval_token_hash = ?, approval_expires_at = ?,
          approved_at = ?, approval_url = ?, technician_notes = ?, client_notes = ?,
          rejection_reason = ?, estimated_delivery = ?, updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """;
    db.update(sql,
        w.getOrderNumber(), w.getDeviceBrand(), w.getDeviceModel(), w.getSerialNumber(),
        w.getReportedFault(), w.getAccessories(), w.getDescription(), w.getDiagnosis(),
        w.getQuote(), w.getStatus(), w.getApprovalTokenHash(), w.getApprovalExpiresAt(),
        w.getApprovedAt(), w.getApprovalUrl(), w.getTechnicianNotes(), w.getClientNotes(),
        w.getRejectionReason(), w.getEstimatedDelivery(), w.getId(), w.getTenantId()
    );

    if (w.getItems() != null) {
      saveItems(w.getTenantId(), w.getId(), w.getItems());
    }
  }

  @Override
  public Optional<WorkOrder> findById(UUID tenantId, UUID orderId) {
    setTenantContext(tenantId);
    try {
      WorkOrder o = db.queryForObject(
          "SELECT * FROM work_orders WHERE tenant_id = ? AND id = ?",
          mapper, tenantId, orderId
      );
      if (o != null) {
        o.setItems(findItemsByOrderId(tenantId, orderId));
      }
      return Optional.ofNullable(o);
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  @Override
  public Optional<WorkOrder> findByTokenHash(UUID tenantId, String tokenHash) {
    setTenantContext(tenantId);
    try {
      WorkOrder o = db.queryForObject(
          "SELECT * FROM work_orders WHERE tenant_id = ? AND approval_token_hash = ?",
          mapper, tenantId, tokenHash
      );
      if (o != null) {
        o.setItems(findItemsByOrderId(tenantId, o.getId()));
      }
      return Optional.ofNullable(o);
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  @Override
  public List<Map<String, Object>> listEnriched(UUID tenantId, String statusFilter, String search) {
    setTenantContext(tenantId);
    StringBuilder sql = new StringBuilder("""
        SELECT w.id, w.tenant_id, w.customer_id, w.branch_id, w.order_number,
               w.device_brand, w.device_model, w.serial_number, w.reported_fault,
               w.accessories, w.description, w.diagnosis, w.quote, w.status,
               w.approval_url, w.approval_expires_at, w.approved_at, w.technician_notes,
               w.client_notes, w.rejection_reason, w.estimated_delivery, w.created_at, w.updated_at,
               c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               b.name AS branch_name
        FROM work_orders w
        LEFT JOIN customers c ON c.id = w.customer_id
        LEFT JOIN branches b ON b.id = w.branch_id
        WHERE w.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(tenantId);

    if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
      sql.append(" AND w.status = ?");
      params.add(statusFilter);
    }

    if (search != null && !search.isBlank()) {
      sql.append(" AND (lower(coalesce(w.order_number,'')) LIKE ? OR lower(coalesce(c.name,'')) LIKE ? OR lower(coalesce(w.device_model,'')) LIKE ? OR lower(coalesce(w.serial_number,'')) LIKE ? OR lower(coalesce(w.description,'')) LIKE ?)");
      String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
    }

    sql.append(" ORDER BY w.created_at DESC");
    List<Map<String, Object>> list = db.queryForList(sql.toString(), params.toArray());

    for (Map<String, Object> row : list) {
      UUID orderId = row.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("id")));
      List<WorkOrderItem> items = findItemsByOrderId(tenantId, orderId);
      List<Map<String, Object>> itemsList = items.stream().map(i -> Map.<String, Object>of(
          "id", i.getId(),
          "itemType", i.getItemType(),
          "name", i.getName(),
          "quantity", i.getQuantity(),
          "unitPrice", i.getUnitPrice(),
          "subtotal", i.getSubtotal()
      )).toList();
      row.put("items", itemsList);
    }

    return list;
  }

  @Override
  public Optional<Map<String, Object>> findPublicTracking(UUID tenantId, String tokenHash) {
    setTenantContext(tenantId);
    String sql = """
        SELECT w.id, w.order_number, w.device_brand, w.device_model, w.serial_number,
               w.reported_fault, w.accessories, w.description, w.diagnosis, w.quote,
               w.status, w.approval_expires_at, w.approved_at, w.client_notes,
               w.rejection_reason, w.estimated_delivery, w.created_at, w.updated_at,
               c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               b.name AS branch_name,
               t.name AS store_name
        FROM work_orders w
        JOIN tenants t ON t.id = w.tenant_id
        JOIN customers c ON c.id = w.customer_id
        LEFT JOIN branches b ON b.id = w.branch_id
        WHERE w.tenant_id = ? AND w.approval_token_hash = ?
        """;
    List<Map<String, Object>> list = db.queryForList(sql, tenantId, tokenHash);
    if (list.isEmpty()) return Optional.empty();

    Map<String, Object> row = new LinkedHashMap<>(list.get(0));
    UUID orderId = row.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("id")));
    List<WorkOrderItem> items = findItemsByOrderId(tenantId, orderId);
    List<Map<String, Object>> itemsList = items.stream().map(i -> Map.<String, Object>of(
        "id", i.getId(),
        "itemType", i.getItemType(),
        "name", i.getName(),
        "quantity", i.getQuantity(),
        "unitPrice", i.getUnitPrice(),
        "subtotal", i.getSubtotal()
    )).toList();
    row.put("items", itemsList);

    return Optional.of(row);
  }

  @Override
  public String generateNextOrderNumber(UUID tenantId) {
    setTenantContext(tenantId);
    Integer count = db.queryForObject(
        "SELECT count(*) FROM work_orders WHERE tenant_id = ?",
        Integer.class, tenantId
    );
    int next = (count == null ? 0 : count) + 1001;
    return "OT-" + next;
  }

  @Override
  public List<WorkOrderItem> findItemsByOrderId(UUID tenantId, UUID orderId) {
    setTenantContext(tenantId);
    return db.query(
        "SELECT * FROM work_order_items WHERE tenant_id = ? AND work_order_id = ? ORDER BY created_at ASC",
        itemMapper, tenantId, orderId
    );
  }

  @Override
  public void saveItems(UUID tenantId, UUID orderId, List<WorkOrderItem> items) {
    setTenantContext(tenantId);
    db.update("DELETE FROM work_order_items WHERE tenant_id = ? AND work_order_id = ?", tenantId, orderId);
    String sql = """
        INSERT INTO work_order_items (id, tenant_id, work_order_id, item_type, name, quantity, unit_price, subtotal, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
    for (WorkOrderItem it : items) {
      db.update(sql,
          it.getId() != null ? it.getId() : UUID.randomUUID(),
          tenantId, orderId, it.getItemType(), it.getName(),
          it.getQuantity(), it.getUnitPrice(), it.getSubtotal(), it.getCreatedAt()
      );
    }
  }
}
