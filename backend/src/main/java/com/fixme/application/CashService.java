package com.fixme.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public class CashService {
  private final CashPort port;
  private final ModuleService modules;

  public CashService(CashPort p, ModuleService m) {
    this.port = p;
    this.modules = m;
  }

  private void enabled(UUID t) {
    modules.require(t, "CASH_REGISTER");
  }

  private void valid(String method, BigDecimal a) {
    if (!Set.of("CASH", "CARD", "TRANSFER", "OTHER").contains(method))
      throw new IllegalArgumentException("Método de pago inválido");
    if (a == null || a.signum() <= 0)
      throw new IllegalArgumentException("El monto debe ser mayor a cero");
  }

  public CashPort.Session open(UUID t, UUID b, UUID u, BigDecimal a, Map<String, BigDecimal> m) {
    enabled(t);
    if (a == null || a.signum() < 0)
      throw new IllegalArgumentException("Monto inicial inválido");
    return port.open(t, b, u, a, m == null ? Map.of("CASH", a) : m);
  }

  public Optional<CashPort.Session> current(UUID t, UUID b) {
    enabled(t);
    return port.current(t, b);
  }

  public CashPort.Session movement(UUID t, UUID b, UUID u, String type, String method, BigDecimal a, String reason, String destination, String reference) {
    enabled(t);
    if (!Set.of("CASH_IN", "CASH_OUT", "DEPOSIT").contains(type))
      throw new IllegalArgumentException("Tipo de movimiento inválido");
    valid(method, a);
    if (reason == null || reason.isBlank())
      throw new IllegalArgumentException("El motivo es obligatorio");
    return port.movement(t, b, u, type, method, a, reason, destination, reference);
  }

  public CashPort.Session close(UUID t, UUID b, UUID u, Map<String, BigDecimal> counted, String depositDestination, String depositReference, BigDecimal depositAmount, BigDecimal nextDayFund) {
    enabled(t);
    if (counted == null)
      throw new IllegalArgumentException("El arqueo es obligatorio");
    return port.close(t, b, u, counted, depositDestination, depositReference, depositAmount, nextDayFund);
  }

  public List<CashPort.Session> report(UUID t, UUID b, Instant f, Instant to) {
    enabled(t);
    return port.report(t, b, f, to);
  }
}
