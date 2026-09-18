package com.fixme.infrastructure.persistence;
import com.fixme.application.ModulePort; import com.fixme.domain.TenantModule;
import java.util.*; import org.springframework.jdbc.core.JdbcTemplate; import org.springframework.stereotype.Repository;
@Repository public class JdbcModuleAdapter implements ModulePort {
 private final JdbcTemplate jdbc; public JdbcModuleAdapter(JdbcTemplate jdbc){this.jdbc=jdbc;}
 private void tenant(UUID id){jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,id.toString());}
 public List<TenantModule> findAll(UUID t){tenant(t);return jdbc.query("select tenant_id,module_key,enabled,updated_at from tenant_modules where tenant_id=? order by module_key",(r,n)->new TenantModule(t,r.getString(2),r.getBoolean(3),r.getTimestamp(4).toInstant()),t);}
 public boolean enabled(UUID t,String k){tenant(t);return Boolean.TRUE.equals(jdbc.queryForObject("select enabled from tenant_modules where tenant_id=? and module_key=?",Boolean.class,t,k));}
 public TenantModule set(UUID t,String k,boolean e){tenant(t); jdbc.update("insert into tenant_modules(tenant_id,module_key,enabled,updated_at) values(?,?,?,now()) on conflict(tenant_id,module_key) do update set enabled=excluded.enabled,updated_at=now()",t,k,e); return findAll(t).stream().filter(m->m.moduleKey().equals(k)).findFirst().orElseThrow();}
}
