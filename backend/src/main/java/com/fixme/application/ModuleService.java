package com.fixme.application;

import com.fixme.domain.TenantModule;
import java.util.*;

public class ModuleService {
  private static final Set<String> KEYS = Set.of(
      "INVENTORY", "POS", "DELIVERIES", "WORK_ORDERS", "CUSTOMERS",
      "REPORTS", "CASH_REGISTER", "QUOTES", "APIS",
      "IMPORTS", "PURCHASES", "WARRANTIES"
  );

  private final ModulePort port;

  public ModuleService(ModulePort port) {
    this.port = port;
  }

  public List<TenantModule> list(UUID tenant) {
    return port.findAll(tenant);
  }

  public void require(UUID tenant, String key) {
    if (!KEYS.contains(key) || !Boolean.TRUE.equals(port.enabled(tenant, key))) {
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.FORBIDDEN, "Módulo " + key + " desactivado"
      );
    }
  }

  public TenantModule set(UUID tenant, String key, boolean enabled) {
    if (!KEYS.contains(key)) throw new IllegalArgumentException("módulo inválido: " + key);
    return port.set(tenant, key, enabled);
  }

  public List<TenantModule> setBulk(UUID tenant, Map<String, Boolean> modules) {
    List<TenantModule> result = new ArrayList<>();
    if (modules != null) {
      for (Map.Entry<String, Boolean> e : modules.entrySet()) {
        String k = e.getKey().toUpperCase(Locale.ROOT);
        if (KEYS.contains(k)) {
          result.add(port.set(tenant, k, Boolean.TRUE.equals(e.getValue())));
        }
      }
    }
    return result;
  }
}
