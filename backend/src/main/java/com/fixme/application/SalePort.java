package com.fixme.application;
import com.fixme.domain.Sale; import java.math.BigDecimal; import java.util.*;
public interface SalePort {
 Sale create(UUID tenant,UUID branch,UUID user,List<Item> items,List<Payment> payments,UUID customerId,Integer warrantyDays);
 List<Sale> list(UUID tenant,UUID branch);
 record Item(UUID productId,int quantity){}
 record Payment(String method,BigDecimal amount){}
}
