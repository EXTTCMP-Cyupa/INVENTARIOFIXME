package com.fixme.application;

import java.util.*;
import org.springframework.stereotype.Service;

/** Single source of truth for role capabilities. Controllers still enforce these server-side. */
@Service
public class AuthorizationService {
  private static final Map<String, Set<String>> CAPABILITIES = Map.of(
      "SUPER_ADMIN", Set.of("*"),
      "TENANT_ADMIN", Set.of("TENANT_PROFILE","BRANCHES","USERS","ROLES","MODULES","PRODUCTS","INVENTORY","POS","CASH","CUSTOMERS","DELIVERIES","WORK_ORDERS","REPORTS"),
      "MANAGER", Set.of("BRANCHES","USERS","PRODUCTS","INVENTORY","POS","CASH","CUSTOMERS","DELIVERIES","WORK_ORDERS","REPORTS"),
      "SELLER", Set.of("PRODUCT_READ","INVENTORY_READ","POS","CASH","CUSTOMERS","WORK_ORDERS"),
      "DELIVERY", Set.of("DELIVERIES","CUSTOMERS"),
      "TECHNICIAN", Set.of("WORK_ORDERS","CUSTOMERS"),
      "ACCOUNTANT", Set.of("REPORTS","CASH_READ","SALES_READ"));

  public boolean can(String role, String capability) {
    return CAPABILITIES.getOrDefault(role, Set.of()).contains("*")
        || CAPABILITIES.getOrDefault(role, Set.of()).contains(capability);
  }

  public boolean canAssign(String creator, String target) {
    if ("SUPER_ADMIN".equals(creator)) return CAPABILITIES.containsKey(target);
    if ("TENANT_ADMIN".equals(creator)) return Set.of("MANAGER","SELLER","DELIVERY","TECHNICIAN","ACCOUNTANT").contains(target);
    if ("MANAGER".equals(creator)) return Set.of("SELLER","DELIVERY","TECHNICIAN","ACCOUNTANT").contains(target);
    return false;
  }

  public Map<String, Set<String>> matrix() { return CAPABILITIES; }
}
