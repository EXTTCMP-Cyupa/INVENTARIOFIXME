package com.fixme.infrastructure.security;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.*;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import java.nio.charset.StandardCharsets;
@org.springframework.context.annotation.Configuration
public class JwtConfig {
 private SecretKeySpec key(String secret) {
   return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
 }
 @Bean SecretKeySpec jwtKey(@Value("${app.jwt-secret}") String secret) { return key(secret); }
 @Bean JwtDecoder jwtDecoder(SecretKeySpec key) { return NimbusJwtDecoder.withSecretKey(key).build(); }
 @Bean JwtEncoder jwtEncoder(SecretKeySpec key) {
   JWKSource<SecurityContext> source = new ImmutableSecret<>(key.getEncoded());
   return new NimbusJwtEncoder(source);
 }
}
