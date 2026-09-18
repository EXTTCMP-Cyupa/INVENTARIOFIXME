package com.fixme.application;
import com.fixme.domain.Product;
import java.util.*;
public class ProductService {
  private final ProductPort port;
  private final ModuleService modules;
  public ProductService(ProductPort port) { this.port=port; this.modules=null; }
  public ProductService(ProductPort port, ModuleService modules) { this.port = port; this.modules=modules; }
  private void require(UUID tenant,String key){if(modules!=null) modules.require(tenant,key);}
  public List<Product> list(UUID tenantId, UUID branchId) { require(tenantId,"INVENTORY"); return port.findAll(tenantId, branchId); }
  public List<Product> list(UUID tenantId) { require(tenantId,"INVENTORY"); return port.findAll(tenantId); }
  public Product create(Product p, UUID branchId) { require(p.tenantId(),"INVENTORY"); return port.create(p, branchId); }
  public Product update(Product p, UUID branchId) { require(p.tenantId(),"INVENTORY"); return port.update(p, branchId); }
  public void movement(UUID tenantId, UUID branchId, UUID productId, int quantity, String type, String reason, UUID userId) {
    if (quantity <= 0 || !Set.of("IN", "OUT", "ADJUSTMENT").contains(type)) throw new IllegalArgumentException("movimiento inválido");
    require(tenantId,"INVENTORY"); port.movement(tenantId, branchId, productId, quantity, type, reason, userId);
  }
}
