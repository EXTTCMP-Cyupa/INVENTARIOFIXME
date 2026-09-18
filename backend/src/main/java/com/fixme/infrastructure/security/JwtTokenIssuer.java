package com.fixme.infrastructure.security;

import com.fixme.application.TokenIssuer;
import com.fixme.domain.AppUser;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenIssuer implements TokenIssuer {
  private final JwtEncoder encoder;

  public JwtTokenIssuer(JwtEncoder encoder) {
    this.encoder = encoder;
  }

  @Override
  public String issue(AppUser user) {
    Instant now = Instant.now();
    JwtClaimsSet claims = JwtClaimsSet.builder()
        .issuer("fixmetiendas")
        .subject(user.email())
        .issuedAt(now)
        .expiresAt(now.plus(8, ChronoUnit.HOURS))
        .claim("tenant_id", user.tenantId().toString())
        .claim("scope", user.role())
        .claim("roles", java.util.List.of(user.role()))
        .build();
    return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
  }
}
