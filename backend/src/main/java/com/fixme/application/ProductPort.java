package com.fixme.application;
import com.fixme.domain.Product;
import java.util.*;
public interface ProductPort {
  default List<Product> findAll(UUID tenantId) { return List.of(); }
  default Product create(Product product) { return product; }
  default List<Product> findAll(UUID tenantId, UUID branchId) { return findAll(tenantId); }
  default Product create(Product product, UUID branchId) { return create(product); }
  default Product update(Product product, UUID branchId) { throw new UnsupportedOperationException(); }
  default void movement(UUID tenantId, UUID branchId, UUID productId, int quantity, String type, String reason, UUID userId) { throw new UnsupportedOperationException(); }
}
