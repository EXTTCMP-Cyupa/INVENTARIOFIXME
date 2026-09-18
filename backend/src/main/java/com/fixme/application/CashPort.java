package com.fixme.application;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public interface CashPort {
  record Session(
      UUID id,
      UUID branchId,
      String status,
      BigDecimal openingCash,
      Map<String, BigDecimal> expected,
      Map<String, BigDecimal> counted,
      Map<String, BigDecimal> difference,
      String closeState,
      Instant openedAt,
      String depositDestination,
      String depositReference,
      BigDecimal depositAmount,
      BigDecimal nextDayFund,
      Instant closedAt
  ) {}

  Session open(UUID tenant, UUID branch, UUID user, BigDecimal opening, Map<String, BigDecimal> amounts);
  Optional<Session> current(UUID tenant, UUID branch);
  Session movement(UUID tenant, UUID branch, UUID user, String type, String method, BigDecimal amount, String reason, String destination, String reference);
  Session close(UUID tenant, UUID branch, UUID user, Map<String, BigDecimal> counted, String depositDestination, String depositReference, BigDecimal depositAmount, BigDecimal nextDayFund);
  List<Session> report(UUID tenant, UUID branch, Instant from, Instant to);
}
