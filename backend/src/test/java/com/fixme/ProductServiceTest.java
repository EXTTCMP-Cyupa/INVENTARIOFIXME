package com.fixme;
import com.fixme.application.*; import com.fixme.domain.*; import org.junit.jupiter.api.Test; import java.math.*; import java.util.*; import static org.junit.jupiter.api.Assertions.*;
class ProductServiceTest { @Test void delegatesTenant(){ UUID t=UUID.randomUUID(); ProductPort p=new ProductPort(){public List<Product> findAll(UUID x){assertEquals(t,x);return List.of();}public Product create(Product x){return x;}}; assertTrue(new ProductService(p).list(t).isEmpty());}}
