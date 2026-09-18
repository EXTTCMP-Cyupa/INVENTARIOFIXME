package com.fixme.infrastructure.security;

import com.fixme.application.PasswordHasher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BcryptPasswordHasher implements PasswordHasher {
  private final PasswordEncoder encoder = new BCryptPasswordEncoder();

  @Override
  public boolean matches(String rawPassword, String encodedPassword) {
    return encoder.matches(rawPassword, encodedPassword);
  }
  @Override
  public String hash(String rawPassword) { return encoder.encode(rawPassword); }
}
