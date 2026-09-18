package com.fixme.application;
import com.fixme.domain.TenantModule;
import java.util.*;
public class ModuleService {
 private static final Set<String> KEYS=Set.of("INVENTORY","POS","DELIVERIES","WORK_ORDERS","CUSTOMERS","REPORTS","CASH_REGISTER");
 private final ModulePort port;
 public ModuleService(ModulePort port){this.port=port;}
 public List<TenantModule> list(UUID tenant){return port.findAll(tenant);}
 public void require(UUID tenant,String key){if(!KEYS.contains(key)||!Boolean.TRUE.equals(port.enabled(tenant,key))) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Módulo "+key+" desactivado");}
 public TenantModule set(UUID tenant,String key,boolean enabled){if(!KEYS.contains(key))throw new IllegalArgumentException("módulo inválido");return port.set(tenant,key,enabled);}
}
