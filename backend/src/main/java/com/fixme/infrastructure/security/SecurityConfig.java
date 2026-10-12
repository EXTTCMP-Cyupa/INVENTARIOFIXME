package com.fixme.infrastructure.security;
import org.springframework.context.annotation.*; import org.springframework.core.annotation.Order; import org.springframework.security.config.annotation.web.builders.HttpSecurity; import org.springframework.security.web.SecurityFilterChain;
@Configuration @org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity public class SecurityConfig {
  @Bean @Order(1) SecurityFilterChain publicSecurity(HttpSecurity http) throws Exception { return http.securityMatcher("/actuator/health","/api/auth/**","/api/public/**","/public/**","/error").csrf(c->c.disable()).cors(c->{}).authorizeHttpRequests(a->a.anyRequest().permitAll()).build(); }
  @Bean @Order(2) SecurityFilterChain security(HttpSecurity http) throws Exception { return http.csrf(c->c.disable()).cors(c->{}).authorizeHttpRequests(a->a.anyRequest().authenticated()).oauth2ResourceServer(o->o.jwt()).build(); }

  public static boolean canViewCosts(org.springframework.security.oauth2.jwt.Jwt jwt) {
    if (jwt == null) return false;
    String primaryRole = jwt.getClaimAsString("primary_role");
    if (primaryRole != null) {
      String r = primaryRole.toUpperCase(java.util.Locale.ROOT);
      if (java.util.Set.of("SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "ACCOUNTANT").contains(r)) {
        return true;
      }
    }
    String scope = jwt.getClaimAsString("scope");
    if (scope != null) {
      for (String s : scope.split(" ")) {
        if (java.util.Set.of("SCOPE_SUPER_ADMIN", "SCOPE_TENANT_ADMIN", "SCOPE_MANAGER", "SCOPE_ACCOUNTANT").contains(s)) {
          return true;
        }
      }
    }
    return false;
  }
}
