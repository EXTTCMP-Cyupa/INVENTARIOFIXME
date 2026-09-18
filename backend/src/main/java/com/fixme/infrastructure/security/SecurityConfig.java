package com.fixme.infrastructure.security;
import org.springframework.context.annotation.*; import org.springframework.core.annotation.Order; import org.springframework.security.config.annotation.web.builders.HttpSecurity; import org.springframework.security.web.SecurityFilterChain;
@Configuration @org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity public class SecurityConfig {
 @Bean @Order(1) SecurityFilterChain publicSecurity(HttpSecurity http) throws Exception { return http.securityMatcher("/actuator/health","/api/auth/**","/api/public/**","/public/**","/error").csrf(c->c.disable()).cors(c->{}).authorizeHttpRequests(a->a.anyRequest().permitAll()).build(); }
 @Bean @Order(2) SecurityFilterChain security(HttpSecurity http) throws Exception { return http.csrf(c->c.disable()).cors(c->{}).authorizeHttpRequests(a->a.anyRequest().authenticated()).oauth2ResourceServer(o->o.jwt()).build(); }
}
