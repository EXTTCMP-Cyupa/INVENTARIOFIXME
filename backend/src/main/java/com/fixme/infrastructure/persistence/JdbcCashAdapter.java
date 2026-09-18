package com.fixme.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixme.application.CashPort;
import java.math.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcCashAdapter implements CashPort {
  private final JdbcTemplate db;
  private final ObjectMapper json = new ObjectMapper();

  public JdbcCashAdapter(JdbcTemplate d) {
    this.db = d;
  }

  private void tenant(UUID t) {
    db.queryForObject("select set_config('app.tenant_id',?,true)", String.class, t.toString());
  }

  private String text(Map<String, BigDecimal> m) {
    try {
      return json.writeValueAsString(m == null ? Map.of() : m);
    } catch (Exception e) {
      throw new IllegalArgumentException("Arqueo inválido");
    }
  }

  private Map<String, BigDecimal> map(String s) {
    try {
      return s == null ? new HashMap<>() : json.readValue(s, new TypeReference<Map<String, BigDecimal>>() {});
    } catch (Exception e) {
      throw new IllegalArgumentException("Resumen inválido");
    }
  }

  private Session row(ResultSet r, int n) throws SQLException {
    Timestamp closedTs = r.getTimestamp("closed_at");
    return new Session(
        r.getObject("id", UUID.class),
        r.getObject("branch_id", UUID.class),
        r.getString("status"),
        r.getBigDecimal("opening_cash"),
        map(r.getString("expected_amounts")),
        map(r.getString("counted_amounts")),
        map(r.getString("difference_amounts")),
        r.getString("close_state"),
        r.getTimestamp("opened_at").toInstant(),
        r.getString("deposit_destination"),
        r.getString("deposit_reference"),
        r.getBigDecimal("deposit_amount"),
        r.getBigDecimal("next_day_fund"),
        closedTs == null ? null : closedTs.toInstant()
    );
  }

  private UUID register(UUID t, UUID b) {
    var ids = db.query(
        "select id from cash_registers where tenant_id=? and branch_id=? and active limit 1",
        (r, n) -> r.getObject(1, UUID.class),
        t, b
    );
    if (ids.isEmpty()) {
      UUID id = UUID.randomUUID();
      db.update("insert into cash_registers(id,tenant_id,branch_id) values(?,?,?)", id, t, b);
      return id;
    }
    return ids.get(0);
  }

  @Transactional
  public Session open(UUID t, UUID b, UUID u, BigDecimal opening, Map<String, BigDecimal> amounts) {
    tenant(t);
    UUID reg = register(t, b);
    try {
      UUID id = UUID.randomUUID();
      db.update(
          "insert into cash_sessions(id,tenant_id,register_id,branch_id,opened_by,opening_cash,opening_amounts) values(?,?,?,?,?,?,?::jsonb)",
          id, t, reg, b, u, opening, text(amounts)
      );
      db.update(
          "insert into cash_movements(tenant_id,session_id,branch_id,type,payment_method,amount,reason,created_by) values(?,?,?,'OPENING','CASH',?,?,?)",
          t, id, b, opening, "Fondo de apertura inicial", u
      );
      return current(t, b).orElseThrow();
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new IllegalStateException("Ya existe una sesión abierta en esta sucursal");
    }
  }

  public Optional<Session> current(UUID t, UUID b) {
    tenant(t);
    var x = db.query("select * from cash_sessions where tenant_id=? and branch_id=? and status='OPEN'", this::row, t, b);
    return x.stream().findFirst();
  }

  @Transactional
  public Session movement(UUID t, UUID b, UUID u, String type, String method, BigDecimal amount, String reason, String destination, String reference) {
    tenant(t);
    Session s = current(t, b).orElseThrow(() -> new IllegalStateException("No hay caja abierta"));
    db.update(
        "insert into cash_movements(tenant_id,session_id,branch_id,type,payment_method,amount,reason,created_by,destination,reference) values(?,?,?,?,?,?,?,?,?,?)",
        t, s.id(), b, type, method, amount, reason, u, destination, reference
    );
    return current(t, b).orElseThrow();
  }

  private Map<String, BigDecimal> expected(UUID t, UUID sid) {
    var m = new HashMap<String, BigDecimal>();
    db.query(
        "select payment_method, sum(case when type in ('OPENING','SALE_CASH','CASH_IN') then amount when type in ('CASH_OUT','REFUND','DEPOSIT') then -amount else 0 end) total from cash_movements where tenant_id=? and session_id=? group by payment_method",
        (r, n) -> {
          m.put(r.getString(1), r.getBigDecimal(2));
          return null;
        },
        t, sid
    );
    return m;
  }

  @Transactional
  public Session close(UUID t, UUID b, UUID u, Map<String, BigDecimal> counted, String depositDestination, String depositReference, BigDecimal depositAmount, BigDecimal nextDayFund) {
    tenant(t);
    Session s = current(t, b).orElseThrow(() -> new IllegalStateException("No hay caja abierta"));
    Map<String, BigDecimal> exp = expected(t, s.id());
    Map<String, BigDecimal> diff = new HashMap<>();

    for (String k : Set.of("CASH", "CARD", "TRANSFER", "OTHER")) {
      diff.put(k, counted.getOrDefault(k, BigDecimal.ZERO).subtract(exp.getOrDefault(k, BigDecimal.ZERO)));
    }

    BigDecimal cash = diff.get("CASH");
    String state = cash.signum() == 0 ? "BALANCED" : cash.signum() < 0 ? "SHORT" : "OVER";

    db.update(
        "update cash_sessions set status='CLOSED', closed_by=?, closed_at=now(), counted_amounts=?::jsonb, expected_amounts=?::jsonb, difference_amounts=?::jsonb, close_state=?, deposit_destination=?, deposit_reference=?, deposit_amount=?, next_day_fund=? where id=? and status='OPEN'",
        u, text(counted), text(exp), text(diff), state,
        depositDestination, depositReference, depositAmount != null ? depositAmount : BigDecimal.ZERO, nextDayFund != null ? nextDayFund : BigDecimal.ZERO,
        s.id()
    );

    if (depositAmount != null && depositAmount.compareTo(BigDecimal.ZERO) > 0) {
      db.update(
          "insert into cash_movements(tenant_id,session_id,branch_id,type,payment_method,amount,reason,created_by,destination,reference) values(?,?,?,'DEPOSIT','CASH',?,?,?,?,?)",
          t, s.id(), b, depositAmount, "Depósito al cierre de caja", u, depositDestination, depositReference
      );
    }

    db.update(
        "insert into cash_movements(tenant_id,session_id,branch_id,type,payment_method,amount,reason,created_by) values(?,?,?,'CLOSING_ADJUSTMENT','CASH',?,?,?)",
        t, s.id(), b, cash.abs().max(new BigDecimal("0.01")), "Cierre " + state, u
    );

    return db.queryForObject("select * from cash_sessions where id=?", this::row, s.id());
  }

  public List<Session> report(UUID t, UUID b, Instant from, Instant to) {
    tenant(t);
    return db.query(
        "select * from cash_sessions where tenant_id=? and (? is null or branch_id=?) and opened_at between ? and ? order by opened_at desc",
        this::row, t, b, b, Timestamp.from(from), Timestamp.from(to)
    );
  }
}
