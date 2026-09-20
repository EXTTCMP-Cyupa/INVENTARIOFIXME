package com.fixme.application;

import com.fixme.domain.Sale;
import java.math.BigDecimal;
import java.util.*;

public interface SalePort {
  Sale create(
      UUID tenant,
      UUID branch,
      UUID user,
      List<Item> items,
      List<Payment> payments,
      UUID customerId,
      Integer warrantyDays,
      String channel,
      String fulfillmentType,
      BigDecimal shippingCost,
      DeliveryInfo delivery,
      BigDecimal discount
  );

  default Sale create(
      UUID tenant,
      UUID branch,
      UUID user,
      List<Item> items,
      List<Payment> payments,
      UUID customerId,
      Integer warrantyDays,
      String channel,
      String fulfillmentType,
      BigDecimal shippingCost,
      DeliveryInfo delivery
  ) {
    return create(tenant, branch, user, items, payments, customerId, warrantyDays, channel, fulfillmentType, shippingCost, delivery, BigDecimal.ZERO);
  }

  List<Sale> list(UUID tenant, UUID branch);

  record Item(UUID productId, int quantity) {}
  record Payment(String method, BigDecimal amount) {}
  record DeliveryInfo(
      String recipientName,
      String recipientPhone,
      String address,
      String notes,
      String courier,
      BigDecimal shippingCost
  ) {}
}
