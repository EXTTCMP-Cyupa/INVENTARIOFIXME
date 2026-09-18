package com.fixme.application;

import com.fixme.domain.AppUser;

public interface TokenIssuer {
  String issue(AppUser user);
}
