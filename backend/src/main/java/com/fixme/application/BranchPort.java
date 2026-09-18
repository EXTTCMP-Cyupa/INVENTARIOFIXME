package com.fixme.application;
import com.fixme.domain.Branch;
import java.util.*;
public interface BranchPort { List<Branch> findAll(UUID tenantId); Branch create(Branch branch); }
