package com.fixme.application;

public interface PasswordHasher {
  boolean matches(String rawPassword, String encodedPassword);
  default String hash(String rawPassword) { throw new UnsupportedOperationException("Este hasher no permite crear contraseñas"); }
}
