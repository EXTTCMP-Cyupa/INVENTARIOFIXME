package com.fixme.application;

import com.fixme.domain.AppUser;
import java.util.Optional;
import java.util.UUID;

public interface AppUserPort {
  Optional<AppUser> findByTenantAndEmail(UUID tenantId, String email);
}
