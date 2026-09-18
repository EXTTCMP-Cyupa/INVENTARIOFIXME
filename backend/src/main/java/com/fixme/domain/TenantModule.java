package com.fixme.domain;
import java.time.Instant;
import java.util.UUID;
public record TenantModule(UUID tenantId, String moduleKey, boolean enabled, Instant updatedAt) {}
