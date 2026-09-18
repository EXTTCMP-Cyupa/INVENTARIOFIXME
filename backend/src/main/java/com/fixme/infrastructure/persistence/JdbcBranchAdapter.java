package com.fixme.infrastructure.persistence;
import com.fixme.application.BranchPort;
import com.fixme.domain.Branch;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
@Repository public class JdbcBranchAdapter implements BranchPort {
  private final JdbcTemplate jdbc;
  public JdbcBranchAdapter(JdbcTemplate jdbc){this.jdbc=jdbc;}
  private void tenant(UUID id){jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,id.toString());}
  @Transactional public List<Branch> findAll(UUID tenant){tenant(tenant);return jdbc.query("select id,tenant_id,name from branches where tenant_id=? and active order by name",(r,n)->new Branch(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3)),tenant);}
  @Transactional public Branch create(Branch b){tenant(b.tenantId());UUID id=UUID.randomUUID();jdbc.update("insert into branches(id,tenant_id,name) values(?,?,?)",id,b.tenantId(),b.name().trim());return new Branch(id,b.tenantId(),b.name().trim());}
}
