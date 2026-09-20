package com.fixme.application;

import com.fixme.domain.Quote;
import com.fixme.domain.QuoteItem;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface QuotePort {
  Quote save(Quote quote);
  void update(Quote quote);
  Optional<Quote> findById(UUID tenantId, UUID quoteId);
  Optional<Quote> findByPublicToken(String token);
  List<Map<String, Object>> listEnriched(UUID tenantId, UUID branchId, String status, String search);
  String generateNextQuoteNumber(UUID tenantId);
  List<QuoteItem> findItemsByQuoteId(UUID tenantId, UUID quoteId);
  void saveItems(UUID tenantId, UUID quoteId, List<QuoteItem> items);
}

