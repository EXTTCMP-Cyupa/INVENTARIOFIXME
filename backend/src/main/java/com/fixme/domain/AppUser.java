package com.fixme.domain;

import java.util.UUID;

public record AppUser(UUID id, UUID tenantId, String email, String passwordHash, String role) {}
