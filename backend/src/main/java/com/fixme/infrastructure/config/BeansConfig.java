package com.fixme.infrastructure.config;
import com.fixme.application.*; import org.springframework.context.annotation.*;
@Configuration public class BeansConfig {
 @Bean ProductService productService(ProductPort p){ return new ProductService(p); }
 @Bean BranchService branchService(BranchPort p){ return new BranchService(p); }
 @Bean ModuleService moduleService(ModulePort p){ return new ModuleService(p); }
 @Bean SaleService saleService(SalePort p, ModuleService m){ return new SaleService(p,m); }
}
