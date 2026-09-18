package com.fixme;

import com.fixme.application.*;
import com.fixme.domain.AppUser;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AuthenticationServiceTest {
  private final UUID tenant = UUID.randomUUID();

  @Test
  void emitsTokenOnlyForMatchingPassword() {
    AppUser user = new AppUser(UUID.randomUUID(), tenant, "user@example.test", "hash", "SELLER");
    AuthenticationService service = new AuthenticationService(
        (t, e) -> Optional.of(user),
        (raw, encoded) -> raw.equals("secret") && encoded.equals("hash"),
        ignored -> "jwt");
    assertEquals("jwt", service.login(tenant, "USER@example.test", "secret"));
    assertThrows(AuthenticationException.class, () -> service.login(tenant, "user@example.test", "wrong"));
  }

  @Test
  void rejectsMissingTenantBeforeRepositoryAccess() {
    AuthenticationService service = new AuthenticationService(
        (t, e) -> { fail("tenant is required"); return Optional.empty(); },
        (raw, encoded) -> true, ignored -> "jwt");
    assertThrows(AuthenticationException.class, () -> service.login(null, "user@example.test", "secret"));
  }
}
