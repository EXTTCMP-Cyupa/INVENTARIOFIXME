package com.fixme.infrastructure.persistence;

import com.fixme.application.AppUserPort;
import com.fixme.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcAppUserAdapter implements AppUserPort {
  private final JdbcTemplate jdbc;

  public JdbcAppUserAdapter(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<AppUser> findByTenantAndEmail(UUID tenantId, String email) {
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
    return jdbc.query("select id, tenant_id, email, password_hash, role from app_users where tenant_id=? and lower(email)=?",
        (r, n) -> new AppUser(r.getObject("id", UUID.class), r.getObject("tenant_id", UUID.class),
            r.getString("email"), r.getString("password_hash"), r.getString("role")),
        tenantId, email).stream().findFirst();
  }
}
