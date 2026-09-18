package com.fixme.domain;
import java.util.UUID;
public record Branch(UUID id, UUID tenantId, String name) {}
