package com.fixme.application;

import com.fixme.domain.Quote;
import com.fixme.domain.QuoteItem;
import com.fixme.domain.Sale;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class QuoteService {
  private final QuotePort port;
  private final ModuleService modules;
  private final SaleService saleService;

  public QuoteService(QuotePort port, ModuleService modules, SaleService saleService) {
    this.port = port;
    this.modules = modules;
    this.saleService = saleService;
  }

  public record QuoteItemInput(
      UUID productId,
      String itemType, // PRODUCT, SERVICE, LABOR
      String description,
      BigDecimal quantity,
      BigDecimal unitPrice,
      BigDecimal discount,
      BigDecimal taxRate
  ) {}

  public record CreateQuoteCommand(
      UUID customerId,
      String customerName,
      String customerPhone,
      String customerEmail,
      String customerIdNumber,
      Integer validDays,
      String notes,
      String terms,
      List<QuoteItemInput> items
  ) {}

  public record ConvertPaymentInput(
      String method, // CASH, CARD, TRANSFER, OTHER
      BigDecimal amount
  ) {}

  public record ConvertToSaleCommand(
      List<ConvertPaymentInput> payments,
      Integer warrantyDays
  ) {}

  public Quote createQuote(UUID tenantId, UUID branchId, UUID userId, CreateQuoteCommand cmd) {
    modules.require(tenantId, "QUOTES");

    UUID quoteId = UUID.randomUUID();
    String quoteNumber = port.generateNextQuoteNumber(tenantId);
    String publicToken = UUID.randomUUID().toString().replace("-", "");

    BigDecimal subtotal = BigDecimal.ZERO;
    BigDecimal totalDiscount = BigDecimal.ZERO;
    BigDecimal totalTax = BigDecimal.ZERO;

    List<QuoteItem> items = new ArrayList<>();
    if (cmd.items() != null) {
      for (QuoteItemInput it : cmd.items()) {
        if (it.description() != null && !it.description().isBlank()) {
          BigDecimal qty = it.quantity() != null && it.quantity().compareTo(BigDecimal.ZERO) > 0 ? it.quantity() : BigDecimal.ONE;
          BigDecimal price = it.unitPrice() != null && it.unitPrice().compareTo(BigDecimal.ZERO) >= 0 ? it.unitPrice() : BigDecimal.ZERO;
          BigDecimal disc = it.discount() != null && it.discount().compareTo(BigDecimal.ZERO) >= 0 ? it.discount() : BigDecimal.ZERO;
          BigDecimal rate = it.taxRate() != null ? it.taxRate() : BigDecimal.valueOf(15.00);

          BigDecimal lineSub = qty.multiply(price).subtract(disc).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
          BigDecimal lineTax = lineSub.multiply(rate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)).setScale(2, RoundingMode.HALF_UP);

          subtotal = subtotal.add(qty.multiply(price).setScale(2, RoundingMode.HALF_UP));
          totalDiscount = totalDiscount.add(disc);
          totalTax = totalTax.add(lineTax);

          items.add(new QuoteItem(
              UUID.randomUUID(), tenantId, quoteId, it.productId(),
              it.itemType() != null ? it.itemType() : "PRODUCT",
              it.description(), qty, price, disc, rate, lineSub.add(lineTax),
              OffsetDateTime.now()
          ));
        }
      }
    }

    BigDecimal grandTotal = subtotal.subtract(totalDiscount).max(BigDecimal.ZERO).add(totalTax).setScale(2, RoundingMode.HALF_UP);
    int days = cmd.validDays() != null && cmd.validDays() > 0 ? cmd.validDays() : 15;
    OffsetDateTime validUntil = OffsetDateTime.now().plusDays(days);

    Quote quote = new Quote(
        quoteId, tenantId, branchId, userId, cmd.customerId(),
        quoteNumber, cmd.customerName(), cmd.customerPhone(), cmd.customerEmail(), cmd.customerIdNumber(),
        subtotal, totalDiscount, totalTax, grandTotal,
        "PENDING", validUntil, cmd.notes(), cmd.terms(),
        publicToken, null, null,
        OffsetDateTime.now(), OffsetDateTime.now()
    );

    quote.setItems(items);
    return port.save(quote);
  }

  public Quote updateQuote(UUID tenantId, UUID quoteId, CreateQuoteCommand cmd) {
    modules.require(tenantId, "QUOTES");

    Quote quote = port.findById(tenantId, quoteId)
        .orElseThrow(() -> new IllegalArgumentException("Cotización no encontrada"));

    if (!quote.isPending()) {
      throw new IllegalStateException("Solo se pueden editar cotizaciones pendientes o en borrador antes de su aprobación o facturación.");
    }

    BigDecimal subtotal = BigDecimal.ZERO;
    BigDecimal totalDiscount = BigDecimal.ZERO;
    BigDecimal totalTax = BigDecimal.ZERO;

    List<QuoteItem> items = new ArrayList<>();
    if (cmd.items() != null) {
      for (QuoteItemInput it : cmd.items()) {
        if (it.description() != null && !it.description().isBlank()) {
          BigDecimal qty = it.quantity() != null && it.quantity().compareTo(BigDecimal.ZERO) > 0 ? it.quantity() : BigDecimal.ONE;
          BigDecimal price = it.unitPrice() != null && it.unitPrice().compareTo(BigDecimal.ZERO) >= 0 ? it.unitPrice() : BigDecimal.ZERO;
          BigDecimal disc = it.discount() != null && it.discount().compareTo(BigDecimal.ZERO) >= 0 ? it.discount() : BigDecimal.ZERO;
          BigDecimal rate = it.taxRate() != null ? it.taxRate() : BigDecimal.valueOf(15.00);

          BigDecimal lineSub = qty.multiply(price).subtract(disc).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
          BigDecimal lineTax = lineSub.multiply(rate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)).setScale(2, RoundingMode.HALF_UP);

          subtotal = subtotal.add(qty.multiply(price).setScale(2, RoundingMode.HALF_UP));
          totalDiscount = totalDiscount.add(disc);
          totalTax = totalTax.add(lineTax);

          items.add(new QuoteItem(
              UUID.randomUUID(), tenantId, quoteId, it.productId(),
              it.itemType() != null ? it.itemType() : "PRODUCT",
              it.description(), qty, price, disc, rate, lineSub.add(lineTax),
              OffsetDateTime.now()
          ));
        }
      }
    }

    BigDecimal grandTotal = subtotal.subtract(totalDiscount).max(BigDecimal.ZERO).add(totalTax).setScale(2, RoundingMode.HALF_UP);
    int days = cmd.validDays() != null && cmd.validDays() > 0 ? cmd.validDays() : 15;
    OffsetDateTime validUntil = OffsetDateTime.now().plusDays(days);

    quote.updateDetails(
        cmd.customerId(), cmd.customerName(), cmd.customerPhone(), cmd.customerEmail(), cmd.customerIdNumber(),
        subtotal, totalDiscount, totalTax, grandTotal,
        validUntil, cmd.notes(), cmd.terms(), items
    );

    port.update(quote);
    port.saveItems(tenantId, quoteId, items);
    return quote;
  }

  public List<Map<String, Object>> listQuotes(UUID tenantId, UUID branchId, String status, String search) {
    modules.require(tenantId, "QUOTES");
    return port.listEnriched(tenantId, branchId, status, search);
  }

  public Optional<Quote> findById(UUID tenantId, UUID quoteId) {
    modules.require(tenantId, "QUOTES");
    return port.findById(tenantId, quoteId);
  }

  public Optional<Quote> findByPublicToken(String token) {
    return port.findByPublicToken(token);
  }

  public Quote updateStatus(UUID tenantId, UUID quoteId, String newStatus) {
    modules.require(tenantId, "QUOTES");
    Quote q = port.findById(tenantId, quoteId)
        .orElseThrow(() -> new IllegalArgumentException("Cotización no encontrada"));
    if (!Quote.VALID_STATUSES.contains(newStatus.toUpperCase())) {
      throw new IllegalArgumentException("Estado no válido: " + newStatus);
    }
    if ("APPROVED".equalsIgnoreCase(newStatus)) {
      q.approve();
    } else if ("REJECTED".equalsIgnoreCase(newStatus)) {
      q.reject();
    }
    port.update(q);
    return q;
  }

  public Sale convertToSale(UUID tenantId, UUID branchId, UUID userId, UUID quoteId, ConvertToSaleCommand cmd) {
    modules.require(tenantId, "QUOTES");
    modules.require(tenantId, "POS");

    Quote quote = port.findById(tenantId, quoteId)
        .orElseThrow(() -> new IllegalArgumentException("Cotización no encontrada"));

    if ("CONVERTED".equalsIgnoreCase(quote.getStatus())) {
      throw new IllegalStateException("Esta cotización ya fue convertida a venta previamente");
    }

    List<QuoteItem> items = quote.getItems();
    if (items == null || items.isEmpty()) {
      throw new IllegalStateException("La cotización no contiene ítems para facturar");
    }

    List<SalePort.Item> saleItems = new ArrayList<>();
    for (QuoteItem qi : items) {
      if (qi.getProductId() != null) {
        saleItems.add(new SalePort.Item(qi.getProductId(), qi.getQuantity().intValue()));
      }
    }

    if (saleItems.isEmpty()) {
      throw new IllegalStateException("La cotización no contiene productos del inventario válidos para registrar la venta");
    }

    List<SalePort.Payment> payments = new ArrayList<>();
    if (cmd.payments() != null) {
      for (ConvertPaymentInput p : cmd.payments()) {
        payments.add(new SalePort.Payment(p.method(), p.amount()));
      }
    }

    if (payments.isEmpty()) {
      payments.add(new SalePort.Payment("CASH", quote.getTotal()));
    }

    int warranty = cmd.warrantyDays() != null ? cmd.warrantyDays() : 30;

    Sale sale = saleService.create(
        tenantId, branchId, userId, saleItems, payments,
        quote.getCustomerId(), warranty, "STORE", "PICKUP",
        BigDecimal.ZERO, null, quote.getDiscount()
    );

    quote.markConverted(sale.id());
    port.update(quote);

    return sale;
  }
}
