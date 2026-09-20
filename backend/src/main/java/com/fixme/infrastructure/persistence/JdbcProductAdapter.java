package com.fixme.infrastructure.persistence;

import com.fixme.application.ProductPort;
import com.fixme.domain.Product;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Repository
public class JdbcProductAdapter implements ProductPort {
  private final JdbcTemplate jdbc;

  public JdbcProductAdapter(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public List<Product> findAll(UUID tenantId, UUID branchId) {
    setTenant(tenantId);
    return jdbc.query("""
        select p.id, p.tenant_id, p.sku, p.name, coalesce(ps.stock, 0), p.price,
               p.purchase_price, p.extra_cost, p.margin_percent, p.category_id,
               coalesce(p.min_stock, 5), coalesce(p.barcode, p.sku)
        from products p
        left join product_stock ps on ps.product_id = p.id and ps.branch_id = ?
        where p.tenant_id = ?
        order by p.name
        """,
        (r, n) -> new Product(
            r.getObject(1, UUID.class),
            r.getObject(2, UUID.class),
            r.getString(3),
            r.getString(4),
            r.getInt(5),
            r.getBigDecimal(6),
            r.getBigDecimal(7),
            r.getBigDecimal(8),
            r.getBigDecimal(9),
            r.getObject(10, UUID.class),
            r.getInt(11),
            r.getString(12)
        ),
        branchId, tenantId);
  }

  @Transactional
  public Product create(Product p, UUID branchId) {
    setTenant(p.tenantId());
    UUID id = Optional.ofNullable(p.id()).orElse(UUID.randomUUID());
    jdbc.update("""
        insert into products(id, tenant_id, sku, name, stock, price, purchase_price, extra_cost, margin_percent, category_id, min_stock, barcode)
        values(?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        """,
        id, p.tenantId(), p.sku(), p.name(), p.price(), p.purchasePrice(), p.extraCost(), p.marginPercent(), p.categoryId(), p.minStock(), p.barcode());
    jdbc.update("insert into product_stock(product_id, branch_id, stock) values(?, ?, ?)", id, branchId, p.stock());
    return new Product(id, p.tenantId(), p.sku(), p.name(), p.stock(), p.price(), p.purchasePrice(), p.extraCost(), p.marginPercent(), p.categoryId(), p.minStock(), p.barcode());
  }

  @Transactional
  public Product update(Product p, UUID branchId) {
    setTenant(p.tenantId());
    int count = jdbc.update("""
        update products set sku = ?, name = ?, price = ?, purchase_price = ?, extra_cost = ?,
               margin_percent = ?, category_id = ?, min_stock = ?, barcode = ?
        where id = ? and tenant_id = ?
        """,
        p.sku(), p.name(), p.price(), p.purchasePrice(), p.extraCost(), p.marginPercent(), p.categoryId(), p.minStock(), p.barcode(), p.id(), p.tenantId());
    if (count == 0) throw new IllegalArgumentException("Producto no encontrado");
    jdbc.update("insert into product_stock(product_id, branch_id, stock) values(?, ?, ?) on conflict(product_id, branch_id) do update set stock = excluded.stock", p.id(), branchId, p.stock());
    return p;
  }

  @Transactional
  public void movement(UUID tenantId, UUID branchId, UUID productId, int quantity, String type, String reason, UUID userId) {
    setTenant(tenantId);
    int delta = type.equals("OUT") ? -quantity : quantity;
    if (type.equals("ADJUSTMENT")) delta = quantity;
    int changed = jdbc.update("update product_stock set stock = stock + ? where product_id = ? and branch_id = ? and stock + ? >= 0", delta, productId, branchId, delta);
    if (changed == 0) throw new IllegalArgumentException("Producto inexistente o stock insuficiente");
    jdbc.update("insert into inventory_movements(tenant_id, branch_id, product_id, type, quantity, reason, created_by) values(?, ?, ?, ?, ?, ?, ?)", tenantId, branchId, productId, type, quantity, reason, userId);
  }

  private void setTenant(UUID tenantId) {
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId.toString());
  }
}
