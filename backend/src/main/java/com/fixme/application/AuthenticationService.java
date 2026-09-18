package com.fixme.application;

import com.fixme.domain.AppUser;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationService {
  private final AppUserPort users;
  private final PasswordHasher passwords;
  private final TokenIssuer tokens;

  public AuthenticationService(AppUserPort users, PasswordHasher passwords, TokenIssuer tokens) {
    this.users = users;
    this.passwords = passwords;
    this.tokens = tokens;
  }

  public String login(UUID tenantId, String email, String password) {
    if (tenantId == null || email == null || email.isBlank() || password == null || password.isBlank()) {
      throw new AuthenticationException();
    }
    AppUser user = users.findByTenantAndEmail(tenantId, email.trim().toLowerCase())
        .orElseThrow(AuthenticationException::new);
    if (!passwords.matches(password, user.passwordHash())) {
      throw new AuthenticationException();
    }
    return tokens.issue(user);
  }
}
