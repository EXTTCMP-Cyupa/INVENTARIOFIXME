package com.fixme.domain;
import java.math.BigDecimal; import java.time.Instant; import java.util.UUID;
public record Sale(UUID id, UUID tenantId, UUID branchId, UUID userId, BigDecimal subtotal, BigDecimal tax, BigDecimal total, String status, Instant createdAt) {}
