package com.fixme.application;
import com.fixme.domain.TenantModule;
import java.util.*;
public interface ModulePort {
 List<TenantModule> findAll(UUID tenantId);
 boolean enabled(UUID tenantId, String key);
 TenantModule set(UUID tenantId, String key, boolean enabled);
}
