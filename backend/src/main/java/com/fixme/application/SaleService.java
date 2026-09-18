package com.fixme.application;

import com.fixme.domain.Sale;
import java.math.*;
import java.util.*;

public class SaleService {
  private final SalePort port;
  private final ModuleService modules;

  public SaleService(SalePort p, ModuleService m) {
    this.port = p;
    this.modules = m;
  }

  public Sale create(UUID tenant, UUID branch, UUID user, List<SalePort.Item> items, List<SalePort.Payment> payments, UUID customerId, Integer warrantyDays) {
    return create(tenant, branch, user, items, payments, customerId, warrantyDays, "STORE", "PICKUP", BigDecimal.ZERO, null);
  }

  public Sale create(
      UUID tenant,
      UUID branch,
      UUID user,
      List<SalePort.Item> items,
      List<SalePort.Payment> payments,
      UUID customerId,
      Integer warrantyDays,
      String channel,
      String fulfillmentType,
      BigDecimal shippingCost,
      SalePort.DeliveryInfo delivery
  ) {
    modules.require(tenant, "POS");
    if (branch == null || items == null || items.isEmpty() || payments == null || payments.isEmpty()) {
      throw new IllegalArgumentException("sucursal, items y pagos son obligatorios");
    }
    if (items.stream().anyMatch(i -> i == null || i.productId() == null || i.quantity() <= 0)) {
      throw new IllegalArgumentException("items inválidos");
    }
    if (payments.stream().anyMatch(p -> p == null || p.method() == null || p.amount() == null || p.amount().signum() <= 0)) {
      throw new IllegalArgumentException("pagos inválidos");
    }
    if (warrantyDays != null && warrantyDays < 0) {
      throw new IllegalArgumentException("los días de garantía no pueden ser negativos");
    }

    String finalChannel = (channel != null && "ONLINE".equalsIgnoreCase(channel.trim())) ? "ONLINE" : "STORE";
    String finalFulfillment = (fulfillmentType != null && "DELIVERY".equalsIgnoreCase(fulfillmentType.trim())) ? "DELIVERY" : "PICKUP";
    BigDecimal finalShipping = shippingCost != null && shippingCost.signum() > 0 ? shippingCost : BigDecimal.ZERO;

    if ("DELIVERY".equals(finalFulfillment)) {
      if (delivery == null || delivery.address() == null || delivery.address().isBlank()) {
        throw new IllegalArgumentException("La dirección de entrega es obligatoria para envíos a domicilio");
      }
    }

    return port.create(tenant, branch, user, items, payments, customerId, warrantyDays, finalChannel, finalFulfillment, finalShipping, delivery);
  }

  public List<Sale> list(UUID tenant, UUID branch) {
    modules.require(tenant, "POS");
    return port.list(tenant, branch);
  }
}
