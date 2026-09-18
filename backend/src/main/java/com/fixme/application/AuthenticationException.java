package com.fixme.application;

public class AuthenticationException extends RuntimeException {
  public AuthenticationException() {
    super("Credenciales inválidas");
  }
}
