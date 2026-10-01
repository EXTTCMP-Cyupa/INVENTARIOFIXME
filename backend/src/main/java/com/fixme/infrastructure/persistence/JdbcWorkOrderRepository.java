package com.fixme.infrastructure.persistence;

import com.fixme.application.WorkOrderPort;
import com.fixme.domain.WorkOrder;
import com.fixme.domain.WorkOrderItem;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    db.queryForObject("SELECT set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }

  private final RowMapper<WorkOrder> mapper = (rs, rowNum) -> mapRow(rs);

  private WorkOrder mapRow(ResultSet rs) throws SQLException {
    WorkOrder wo = new WorkOrder(
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
        rs.getObject("assigned_technician_id", UUID.class),
        rs.getInt("sla_hours"),
        rs.getObject("sla_deadline", OffsetDateTime.class),
        rs.getObject("created_at", OffsetDateTime.class),
        rs.getObject("updated_at", OffsetDateTime.class)
    );
    try {
      wo.setIntakeChecklist(rs.getString("intake_checklist"));
    } catch (Exception ignored) {}
    try {
      wo.setLegalDisclaimerAccepted(rs.getObject("legal_disclaimer_accepted", Boolean.class));
    } catch (Exception ignored) {}
    try {
      wo.setClientSignature(rs.getString("client_signature"));
    } catch (Exception ignored) {}
    try {
      wo.setDiagnosticFee(rs.getBigDecimal("diagnostic_fee"));
    } catch (Exception ignored) {}
    return wo;
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
          client_notes, rejection_reason, estimated_delivery, assigned_technician_id,
          sla_hours, sla_deadline, intake_checklist, legal_disclaimer_accepted, client_signature,
          diagnostic_fee, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?)
        """;
    String chk = w.getIntakeChecklist() != null && !w.getIntakeChecklist().isBlank() ? w.getIntakeChecklist() : "{}";
    Boolean legal = w.getLegalDisclaimerAccepted() != null ? w.getLegalDisclaimerAccepted() : true;
    db.update(sql,
        w.getId(), w.getTenantId(), w.getCustomerId(), w.getBranchId(), w.getOrderNumber(),
        w.getDeviceBrand(), w.getDeviceModel(), w.getSerialNumber(), w.getReportedFault(), w.getAccessories(),
        w.getDescription(), w.getDiagnosis(), w.getQuote(), w.getStatus(), w.getApprovalTokenHash(),
        w.getApprovalExpiresAt(), w.getApprovedAt(), w.getApprovalUrl(), w.getTechnicianNotes(),
        w.getClientNotes(), w.getRejectionReason(), w.getEstimatedDelivery(), w.getAssignedTechnicianId(),
        w.getSlaHours(), w.getSlaDeadline(), chk, legal, w.getClientSignature(),
        w.getDiagnosticFee(), w.getCreatedAt(), w.getUpdatedAt()
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
          rejection_reason = ?, estimated_delivery = ?, assigned_technician_id = ?,
          sla_hours = ?, sla_deadline = ?,
          intake_checklist = coalesce(?::jsonb, intake_checklist),
          legal_disclaimer_accepted = coalesce(?, legal_disclaimer_accepted),
          diagnostic_fee = coalesce(?, diagnostic_fee),
          updated_at = now()
        WHERE id = ? AND tenant_id = ?
        """;
    String chk = w.getIntakeChecklist() != null && !w.getIntakeChecklist().isBlank() ? w.getIntakeChecklist() : null;
    db.update(sql,
        w.getOrderNumber(), w.getDeviceBrand(), w.getDeviceModel(), w.getSerialNumber(),
        w.getReportedFault(), w.getAccessories(), w.getDescription(), w.getDiagnosis(),
        w.getQuote(), w.getStatus(), w.getApprovalTokenHash(), w.getApprovalExpiresAt(),
        w.getApprovedAt(), w.getApprovalUrl(), w.getTechnicianNotes(), w.getClientNotes(),
        w.getRejectionReason(), w.getEstimatedDelivery(), w.getAssignedTechnicianId(),
        w.getSlaHours(), w.getSlaDeadline(), chk, w.getLegalDisclaimerAccepted(),
        w.getDiagnosticFee(),
        w.getId(), w.getTenantId()
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

  private static final String BASE_ENRICHED_SELECT = """
      SELECT w.id, w.tenant_id, w.customer_id, w.branch_id, w.order_number,
             w.device_brand, w.device_model, w.serial_number, w.reported_fault,
             w.accessories, w.description, w.diagnosis, w.quote, w.status,
             w.diagnostic_fee,
             w.approval_url, w.approval_expires_at, w.approved_at, w.technician_notes,
             w.client_notes, w.rejection_reason, w.estimated_delivery, w.created_at, w.updated_at,
             w.assigned_technician_id,
             w.intake_checklist, w.legal_disclaimer_accepted,
             COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) AS sla_deadline,
             COALESCE(w.sla_hours, 48) AS sla_hours,
             c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
             b.name AS branch_name,
             COALESCE(NULLIF(tech.full_name, ''), tech.email) AS technician_name,
             tech.phone AS technician_phone
      FROM work_orders w
      LEFT JOIN customers c ON c.id = w.customer_id
      LEFT JOIN branches b ON b.id = w.branch_id
      LEFT JOIN app_users tech ON tech.id = w.assigned_technician_id
      WHERE w.tenant_id = ?
      """;

  private String encodeCursor(OffsetDateTime createdAt, UUID id) {
    if (createdAt == null || id == null) return null;
    String raw = createdAt.toInstant().toEpochMilli() + ":" + id;
    return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }

  private record DecodedCursor(OffsetDateTime createdAt, UUID id) {}

  private DecodedCursor decodeCursor(String cursor) {
    if (cursor == null || cursor.isBlank()) return null;
    try {
      String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      String[] parts = raw.split(":");
      if (parts.length == 2) {
        long epochMilli = Long.parseLong(parts[0]);
        OffsetDateTime dt = OffsetDateTime.ofInstant(Instant.ofEpochMilli(epochMilli), ZoneOffset.UTC);
        UUID id = UUID.fromString(parts[1]);
        return new DecodedCursor(dt, id);
      }
    } catch (Exception ignored) {}
    return null;
  }

  private void applyFilters(
      StringBuilder sql,
      List<Object> params,
      String statusFilter,
      String search,
      UUID technicianId,
      Boolean unassignedOnly,
      String sla,
      String from,
      String to
  ) {
    if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
      if (statusFilter.contains(",")) {
        String[] statuses = statusFilter.split(",");
        List<String> valid = Arrays.stream(statuses).map(String::trim).filter(s -> !s.isEmpty()).toList();
        if (!valid.isEmpty()) {
          sql.append(" AND w.status IN (").append(String.join(",", Collections.nCopies(valid.size(), "?"))).append(")");
          params.addAll(valid);
        }
      } else {
        sql.append(" AND w.status = ?");
        params.add(statusFilter.trim());
      }
    }

    if (Boolean.TRUE.equals(unassignedOnly)) {
      sql.append(" AND w.assigned_technician_id IS NULL");
    } else if (technicianId != null) {
      sql.append(" AND w.assigned_technician_id = ?");
      params.add(technicianId);
    }

    if (search != null && !search.isBlank()) {
      sql.append(" AND (lower(coalesce(w.order_number,'')) LIKE ? OR lower(coalesce(c.name,'')) LIKE ? OR lower(coalesce(w.device_model,'')) LIKE ? OR lower(coalesce(w.serial_number,'')) LIKE ? OR lower(coalesce(w.description,'')) LIKE ? OR lower(coalesce(tech.full_name,'')) LIKE ?)");
      String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
      for (int i = 0; i < 6; i++) {
        params.add(pattern);
      }
    }

    if (sla != null && !sla.isBlank()) {
      if ("overdue".equalsIgnoreCase(sla)) {
        sql.append(" AND w.status NOT IN ('DELIVERED', 'ENTREGADO', 'PAGADO', 'CANCELLED', 'REJECTED', 'CANCELADO')")
           .append(" AND COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) < now()");
      } else if ("critical".equalsIgnoreCase(sla)) {
        sql.append(" AND w.status NOT IN ('DELIVERED', 'ENTREGADO', 'PAGADO', 'CANCELLED', 'REJECTED', 'CANCELADO')")
           .append(" AND COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) BETWEEN now() AND now() + interval '12 hours'");
      } else if ("ok".equalsIgnoreCase(sla)) {
        sql.append(" AND COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) > now() + interval '12 hours'");
      }
    }

    if (from != null && !from.isBlank()) {
      try {
        OffsetDateTime fromDt = OffsetDateTime.parse(from);
        sql.append(" AND w.created_at >= ?");
        params.add(fromDt);
      } catch (Exception e) {
        try {
          sql.append(" AND w.created_at >= ?::timestamptz");
          params.add(from);
        } catch (Exception ignored) {}
      }
    }

    if (to != null && !to.isBlank()) {
      try {
        OffsetDateTime toDt = OffsetDateTime.parse(to);
        sql.append(" AND w.created_at <= ?");
        params.add(toDt);
      } catch (Exception e) {
        try {
          sql.append(" AND w.created_at <= ?::timestamptz");
          params.add(to);
        } catch (Exception ignored) {}
      }
    }
  }

  private void populateItemsAndImagesBatch(UUID tenantId, List<Map<String, Object>> list) {
    if (list == null || list.isEmpty()) return;

    List<UUID> orderIds = new ArrayList<>();
    Map<UUID, Map<String, Object>> rowMap = new HashMap<>();
    for (Map<String, Object> row : list) {
      UUID orderId = row.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("id")));
      orderIds.add(orderId);
      rowMap.put(orderId, row);
      row.put("items", new ArrayList<Map<String, Object>>());
      row.put("images", new ArrayList<Map<String, Object>>());
    }

    String inPlaceholders = String.join(",", Collections.nCopies(orderIds.size(), "?"));

    // Batch query items for all returned orders in ONE single query
    String itemsSql = "SELECT id, tenant_id, work_order_id, item_type, name, quantity, unit_price, subtotal " +
                      "FROM work_order_items WHERE tenant_id = ? AND work_order_id IN (" + inPlaceholders + ") ORDER BY created_at ASC";
    List<Object> itemParams = new ArrayList<>();
    itemParams.add(tenantId);
    itemParams.addAll(orderIds);
    List<Map<String, Object>> allItems = db.queryForList(itemsSql, itemParams.toArray());
    for (Map<String, Object> item : allItems) {
      UUID orderId = item.get("work_order_id") instanceof UUID u ? u : UUID.fromString(String.valueOf(item.get("work_order_id")));
      Map<String, Object> targetRow = rowMap.get(orderId);
      if (targetRow != null) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsList = (List<Map<String, Object>>) targetRow.get("items");
        itemsList.add(Map.of(
            "id", item.get("id"),
            "itemType", item.get("item_type") != null ? item.get("item_type") : "PART",
            "name", item.get("name") != null ? item.get("name") : "",
            "quantity", item.get("quantity") != null ? item.get("quantity") : BigDecimal.ONE,
            "unitPrice", item.get("unit_price") != null ? item.get("unit_price") : BigDecimal.ZERO,
            "subtotal", item.get("subtotal") != null ? item.get("subtotal") : BigDecimal.ZERO
        ));
      }
    }

    // Batch query images for all returned orders in ONE single query
    String imagesSql = "SELECT id, work_order_id, stage, image_url, caption, created_at " +
                       "FROM work_order_images WHERE work_order_id IN (" + inPlaceholders + ") ORDER BY created_at ASC";
    List<Map<String, Object>> allImages = db.queryForList(imagesSql, orderIds.toArray());
    for (Map<String, Object> img : allImages) {
      UUID orderId = img.get("work_order_id") instanceof UUID u ? u : UUID.fromString(String.valueOf(img.get("work_order_id")));
      Map<String, Object> targetRow = rowMap.get(orderId);
      if (targetRow != null) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> imagesList = (List<Map<String, Object>>) targetRow.get("images");
        imagesList.add(img);
      }
    }
  }

  @Override
  public List<Map<String, Object>> listEnriched(UUID tenantId, String statusFilter, String search, UUID technicianId) {
    setTenantContext(tenantId);
    StringBuilder sql = new StringBuilder(BASE_ENRICHED_SELECT);
    List<Object> params = new ArrayList<>();
    params.add(tenantId);

    applyFilters(sql, params, statusFilter, search, technicianId, null, null, null, null);
    sql.append(" ORDER BY w.created_at DESC");

    List<Map<String, Object>> list = new ArrayList<>(db.queryForList(sql.toString(), params.toArray()));
    populateItemsAndImagesBatch(tenantId, list);
    return list;
  }

  @Override
  public PagedOrdersResult listEnrichedPaged(UUID tenantId, WorkOrderQueryParams query) {
    setTenantContext(tenantId);

    int pageSize = (query.limit() != null && query.limit() > 0) ? Math.min(query.limit(), 100) : 25;

    // Fast total count query
    StringBuilder countSql = new StringBuilder("""
        SELECT COUNT(*)
        FROM work_orders w
        LEFT JOIN customers c ON c.id = w.customer_id
        LEFT JOIN branches b ON b.id = w.branch_id
        LEFT JOIN app_users tech ON tech.id = w.assigned_technician_id
        WHERE w.tenant_id = ?
        """);
    List<Object> countParams = new ArrayList<>();
    countParams.add(tenantId);
    applyFilters(countSql, countParams, query.status(), query.search(), query.technicianId(), query.unassignedOnly(), query.sla(), query.from(), query.to());
    Long totalCount = db.queryForObject(countSql.toString(), Long.class, countParams.toArray());
    long total = totalCount != null ? totalCount : 0L;

    // Build data query
    StringBuilder sql = new StringBuilder(BASE_ENRICHED_SELECT);
    List<Object> params = new ArrayList<>();
    params.add(tenantId);
    applyFilters(sql, params, query.status(), query.search(), query.technicianId(), query.unassignedOnly(), query.sla(), query.from(), query.to());

    // Cursor condition: default sort is created_at DESC, id DESC
    DecodedCursor decoded = decodeCursor(query.cursor());
    if (decoded != null) {
      sql.append(" AND (w.created_at < ? OR (w.created_at = ? AND w.id < ?))");
      params.add(decoded.createdAt());
      params.add(decoded.createdAt());
      params.add(decoded.id());
    }

    // Sort order
    if ("sla_asc".equalsIgnoreCase(query.sort())) {
      sql.append(" ORDER BY COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) ASC, w.id ASC");
    } else if ("created_asc".equalsIgnoreCase(query.sort())) {
      sql.append(" ORDER BY w.created_at ASC, w.id ASC");
    } else if ("updated_desc".equalsIgnoreCase(query.sort())) {
      sql.append(" ORDER BY w.updated_at DESC, w.id DESC");
    } else {
      sql.append(" ORDER BY w.created_at DESC, w.id DESC");
    }

    // Query pageSize + 1 to detect hasMore
    sql.append(" LIMIT ?");
    params.add(pageSize + 1);

    List<Map<String, Object>> rows = new ArrayList<>(db.queryForList(sql.toString(), params.toArray()));
    boolean hasMore = rows.size() > pageSize;
    if (hasMore) {
      rows.remove(rows.size() - 1);
    }

    String nextCursor = null;
    if (hasMore && !rows.isEmpty()) {
      Map<String, Object> last = rows.get(rows.size() - 1);
      UUID lastId = last.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(last.get("id")));
      OffsetDateTime lastCreated = null;
      Object cAt = last.get("created_at");
      if (cAt instanceof OffsetDateTime odt) {
        lastCreated = odt;
      } else if (cAt instanceof java.sql.Timestamp ts) {
        lastCreated = ts.toInstant().atOffset(ZoneOffset.UTC);
      } else if (cAt != null) {
        try {
          lastCreated = OffsetDateTime.parse(cAt.toString());
        } catch (Exception ignored) {}
      }
      nextCursor = encodeCursor(lastCreated, lastId);
    }

    // Batch populate items and images in 2 bulk queries (no N+1 queries!)
    populateItemsAndImagesBatch(tenantId, rows);

    return new PagedOrdersResult(rows, nextCursor, hasMore, total);
  }

  @Override
  public Map<String, Object> countOrdersByStatus(UUID tenantId, UUID technicianId, String search, String from, String to) {
    setTenantContext(tenantId);
    StringBuilder sql = new StringBuilder("""
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE w.status IN ('OPEN', 'RECIBIDO')) AS open,
          COUNT(*) FILTER (WHERE w.status IN ('DIAGNOSIS', 'EN_DIAGNOSTICO')) AS diagnosis,
          COUNT(*) FILTER (WHERE w.status IN ('QUOTED', 'COTIZADO')) AS quoted,
          COUNT(*) FILTER (WHERE w.status IN ('ESPERANDO_REPUESTOS', 'WAITING_PARTS')) AS waiting_parts,
          COUNT(*) FILTER (WHERE w.status IN ('EN_REPARACION', 'IN_PROGRESS')) AS repair,
          COUNT(*) FILTER (WHERE w.status IN ('TESTING', 'EN_PRUEBAS', 'PRUEBAS')) AS testing,
          COUNT(*) FILTER (WHERE w.status IN ('LISTO_ENTREGA', 'COMPLETED')) AS ready,
          COUNT(*) FILTER (WHERE w.status IN ('DELIVERED', 'ENTREGADO', 'PAGADO')) AS delivered,
          COUNT(*) FILTER (WHERE w.status IN ('CANCELLED', 'REJECTED', 'RECHAZADO', 'CANCELADO')) AS cancelled,
          COUNT(*) FILTER (WHERE w.status NOT IN ('DELIVERED', 'ENTREGADO', 'PAGADO', 'CANCELLED', 'REJECTED', 'CANCELADO')
                           AND COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) < now()) AS sla_overdue,
          COUNT(*) FILTER (WHERE w.status NOT IN ('DELIVERED', 'ENTREGADO', 'PAGADO', 'CANCELLED', 'REJECTED', 'CANCELADO')
                           AND COALESCE(w.sla_deadline, w.created_at + (COALESCE(w.sla_hours, 48) || ' hours')::interval) BETWEEN now() AND now() + interval '12 hours') AS sla_critical
        FROM work_orders w
        LEFT JOIN customers c ON c.id = w.customer_id
        LEFT JOIN app_users tech ON tech.id = w.assigned_technician_id
        WHERE w.tenant_id = ?
        """);

    List<Object> params = new ArrayList<>();
    params.add(tenantId);

    if (technicianId != null) {
      sql.append(" AND w.assigned_technician_id = ?");
      params.add(technicianId);
    }

    if (search != null && !search.isBlank()) {
      sql.append(" AND (lower(coalesce(w.order_number,'')) LIKE ? OR lower(coalesce(c.name,'')) LIKE ? OR lower(coalesce(w.device_model,'')) LIKE ? OR lower(coalesce(w.serial_number,'')) LIKE ? OR lower(coalesce(w.description,'')) LIKE ? OR lower(coalesce(tech.full_name,'')) LIKE ?)");
      String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
      for (int i = 0; i < 6; i++) {
        params.add(pattern);
      }
    }

    if (from != null && !from.isBlank()) {
      try {
        OffsetDateTime fromDt = OffsetDateTime.parse(from);
        sql.append(" AND w.created_at >= ?");
        params.add(fromDt);
      } catch (Exception e) {
        try {
          sql.append(" AND w.created_at >= ?::timestamptz");
          params.add(from);
        } catch (Exception ignored) {}
      }
    }

    if (to != null && !to.isBlank()) {
      try {
        OffsetDateTime toDt = OffsetDateTime.parse(to);
        sql.append(" AND w.created_at <= ?");
        params.add(toDt);
      } catch (Exception e) {
        try {
          sql.append(" AND w.created_at <= ?::timestamptz");
          params.add(to);
        } catch (Exception ignored) {}
      }
    }

    Map<String, Object> map = new HashMap<>(db.queryForMap(sql.toString(), params.toArray()));

    // Add camelCase and uppercase aliases for convenience
    map.put("slaOverdue", map.get("sla_overdue"));
    map.put("slaCritical", map.get("sla_critical"));
    map.put("waitingParts", map.get("waiting_parts"));
    map.put("OPEN", map.get("open"));
    map.put("DIAGNOSIS", map.get("diagnosis"));
    map.put("COTIZADO", map.get("quoted"));
    map.put("ESPERANDO_REPUESTOS", map.get("waiting_parts"));
    map.put("EN_REPARACION", map.get("repair"));
    map.put("TESTING", map.get("testing"));
    map.put("LISTO_ENTREGA", map.get("ready"));
    map.put("DELIVERED", map.get("delivered"));
    map.put("CANCELLED", map.get("cancelled"));

    return map;
  }

  @Override
  public Optional<Map<String, Object>> findPublicTracking(UUID tenantId, String tokenHash) {
    setTenantContext(tenantId);
    String sql = """
        SELECT w.id, w.order_number, w.device_brand, w.device_model, w.serial_number,
               w.reported_fault, w.accessories, w.description, w.diagnosis, w.quote,
               w.diagnostic_fee,
               w.status, w.approval_expires_at, w.approved_at, w.client_notes,
               w.rejection_reason, w.estimated_delivery, w.created_at, w.updated_at,
               w.intake_checklist, w.legal_disclaimer_accepted,
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

    List<Map<String, Object>> images = db.queryForList(
        "SELECT id, stage, image_url, caption, created_at FROM work_order_images WHERE work_order_id = ? ORDER BY created_at ASC",
        orderId
    );
    row.put("images", images);

    return Optional.of(row);
  }

  @Override
  public Optional<Map<String, Object>> findPublicTrackingByCode(String code) {
    if (code == null || code.isBlank()) return Optional.empty();
    String c = code.trim();
    String sql = """
        SELECT w.id, w.tenant_id, w.order_number, w.device_brand, w.device_model, w.serial_number,
               w.reported_fault, w.accessories, w.description, w.diagnosis, w.quote,
               w.diagnostic_fee,
               w.status, w.approval_expires_at, w.approved_at, w.client_notes,
               w.rejection_reason, w.estimated_delivery, w.created_at, w.updated_at,
               w.approval_url, w.intake_checklist, w.legal_disclaimer_accepted,
               c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
               b.name AS branch_name, COALESCE(t.address, '') AS branch_address, COALESCE(t.phone, '') AS branch_phone,
               t.name AS store_name
        FROM work_orders w
        JOIN tenants t ON t.id = w.tenant_id
        JOIN customers c ON c.id = w.customer_id
        LEFT JOIN branches b ON b.id = w.branch_id
        WHERE """;

    List<Map<String, Object>> list;
    if (c.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
      list = db.queryForList(sql + " w.id = ?", UUID.fromString(c));
    } else if (c.contains(".")) {
      String[] parts = c.split("\\.");
      try {
        UUID tId = UUID.fromString(parts[0]);
        String tokenHash = hashString(c);
        list = db.queryForList(sql + " w.tenant_id = ? AND w.approval_token_hash = ?", tId, tokenHash);
      } catch (Exception e) {
        list = Collections.emptyList();
      }
    } else {
      list = db.queryForList(sql + " (lower(w.order_number) = lower(?) OR lower(w.order_number) = lower(?)) ORDER BY w.created_at DESC LIMIT 1", c, "OT-" + c);
    }

    if (list.isEmpty()) return Optional.empty();

    Map<String, Object> row = new LinkedHashMap<>(list.get(0));
    UUID tenantId = row.get("tenant_id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("tenant_id")));
    UUID orderId = row.get("id") instanceof UUID u ? u : UUID.fromString(String.valueOf(row.get("id")));
    List<WorkOrderItem> items = findItemsByOrderId(tenantId, orderId);
    List<Map<String, Object>> itemsList = items.stream().map(i -> Map.<String, Object>of(
        "id", i.getId(),
        "itemType", i.getItemType() != null ? i.getItemType() : "PART",
        "name", i.getName(),
        "quantity", i.getQuantity(),
        "unitPrice", i.getUnitPrice(),
        "subtotal", i.getSubtotal()
    )).toList();
    row.put("items", itemsList);

    List<Map<String, Object>> images = db.queryForList(
        "SELECT id, stage, image_url, caption, created_at FROM work_order_images WHERE work_order_id = ? ORDER BY created_at ASC",
        orderId
    );
    row.put("images", images);

    return Optional.of(row);
  }

  private String hashString(String base) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(base.getBytes(StandardCharsets.UTF_8));
      StringBuilder hexString = new StringBuilder();
      for (byte b : hash) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
      }
      return hexString.toString();
    } catch (Exception ex) {
      throw new RuntimeException("Error calculando SHA-256", ex);
    }
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
