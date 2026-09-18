package com.fixme.application;
import com.fixme.domain.Branch;
import java.util.*;
public class BranchService {
  private final BranchPort port;
  public BranchService(BranchPort port) { this.port=port; }
  public List<Branch> list(UUID tenant) { return port.findAll(tenant); }
  public Branch create(Branch branch) { if (branch.name()==null || branch.name().isBlank()) throw new IllegalArgumentException("nombre obligatorio"); return port.create(branch); }
}
