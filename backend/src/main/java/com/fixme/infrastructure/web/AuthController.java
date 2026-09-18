package com.fixme.infrastructure.web;

import com.fixme.application.AuthenticationException;
import com.fixme.application.AuthenticationService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthenticationService authentication;

  public AuthController(AuthenticationService authentication) {
    this.authentication = authentication;
  }

  public record LoginRequest(UUID tenantId, String email, String password) {}
  public record LoginResponse(String accessToken, String tokenType, long expiresIn) {}

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    try {
      if (request == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }
      String token = authentication.login(request.tenantId(), request.email(), request.password());
      return ResponseEntity.ok(new LoginResponse(token, "Bearer", 8 * 60 * 60));
    } catch (AuthenticationException exception) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }
}
