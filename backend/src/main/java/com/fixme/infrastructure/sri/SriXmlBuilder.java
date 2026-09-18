package com.fixme.infrastructure.sri;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

public final class SriXmlBuilder {

  private SriXmlBuilder() {}

  private static final DateTimeFormatter SRI_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

  public record ItemDetail(
      String code,
      String description,
      BigDecimal quantity,
      BigDecimal unitPrice,
      BigDecimal discount,
      BigDecimal lineTotal,
      boolean subjectToIva // true = 15%, false = 0%
  ) {}

  public record InvoiceData(
      String accessKey,
      int environment, // 1 or 2
      String emitterRuc,
      String emitterLegalName,
      String emitterTradeName,
      String emitterMatrixAddress,
      String emitterBranchAddress,
      String establishment,
      String emissionPoint,
      String sequential,
      boolean requiresAccounting,
      String taxRegime, // GENERAL, RIMPE_EMPRENDEDOR, RIMPE_NEGOCIO_POPULAR, AGENTE_RETENCION
      String specialTaxpayerNumber,
      String retentionAgentNumber,
      LocalDate emissionDate,
      String buyerIdType, // 04: RUC, 05: Cedula, 06: Pasaporte, 07: Consumidor Final
      String buyerIdNumber,
      String buyerName,
      String buyerAddress,
      String buyerPhone,
      String buyerEmail,
      BigDecimal subtotalSinImpuestos,
      BigDecimal subtotal15,
      BigDecimal subtotal0,
      BigDecimal iva15Amount,
      BigDecimal totalDiscount,
      BigDecimal grandTotal,
      String sriPaymentMethod, // 01: Sin sist. financiero, 16: Debito, 19: Credito, 20: Otros
      List<ItemDetail> items,
      Map<String, String> additionalInfo
  ) {}

  public static String buildFacturaXml(InvoiceData d) {
    StringBuilder xml = new StringBuilder();
    xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.append("<factura id=\"comprobante\" version=\"1.1.0\">\n");

    // 1. infoTributaria
    xml.append("  <infoTributaria>\n");
    xml.append("    <ambiente>").append(d.environment()).append("</ambiente>\n");
    xml.append("    <tipoEmision>1</tipoEmision>\n");
    xml.append("    <razonSocial>").append(escapeXml(d.emitterLegalName())).append("</razonSocial>\n");
    if (d.emitterTradeName() != null && !d.emitterTradeName().isBlank()) {
      xml.append("    <nombreComercial>").append(escapeXml(d.emitterTradeName())).append("</nombreComercial>\n");
    }
    xml.append("    <ruc>").append(d.emitterRuc()).append("</ruc>\n");
    xml.append("    <claveAcceso>").append(d.accessKey()).append("</claveAcceso>\n");
    xml.append("    <codDoc>01</codDoc>\n"); // 01 = Factura
    xml.append("    <estab>").append(String.format("%03d", Integer.parseInt(d.establishment()))).append("</estab>\n");
    xml.append("    <ptoEmi>").append(String.format("%03d", Integer.parseInt(d.emissionPoint()))).append("</ptoEmi>\n");
    xml.append("    <secuencial>").append(String.format("%09d", Long.parseLong(d.sequential()))).append("</secuencial>\n");
    xml.append("    <dirMatriz>").append(escapeXml(d.emitterMatrixAddress())).append("</dirMatriz>\n");
    
    if (d.taxRegime() != null && d.taxRegime().toUpperCase().contains("RIMPE")) {
      xml.append("    <contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe>\n");
    }
    if (d.retentionAgentNumber() != null && !d.retentionAgentNumber().isBlank()) {
      xml.append("    <agenteRetencion>").append(escapeXml(d.retentionAgentNumber())).append("</agenteRetencion>\n");
    }
    xml.append("  </infoTributaria>\n");

    // 2. infoFactura
    xml.append("  <infoFactura>\n");
    xml.append("    <fechaEmision>").append((d.emissionDate() != null ? d.emissionDate() : LocalDate.now()).format(SRI_DATE)).append("</fechaEmision>\n");
    if (d.emitterBranchAddress() != null && !d.emitterBranchAddress().isBlank()) {
      xml.append("    <dirEstablecimiento>").append(escapeXml(d.emitterBranchAddress())).append("</dirEstablecimiento>\n");
    }
    if (d.specialTaxpayerNumber() != null && !d.specialTaxpayerNumber().isBlank()) {
      xml.append("    <contribuyenteEspecial>").append(escapeXml(d.specialTaxpayerNumber())).append("</contribuyenteEspecial>\n");
    }
    xml.append("    <obligadoContabilidad>").append(d.requiresAccounting() ? "SI" : "NO").append("</obligadoContabilidad>\n");
    xml.append("    <tipoIdentificacionComprador>").append(d.buyerIdType()).append("</tipoIdentificacionComprador>\n");
    xml.append("    <razonSocialComprador>").append(escapeXml(d.buyerName())).append("</razonSocialComprador>\n");
    xml.append("    <identificacionComprador>").append(escapeXml(d.buyerIdNumber())).append("</identificacionComprador>\n");
    if (d.buyerAddress() != null && !d.buyerAddress().isBlank()) {
      xml.append("    <direccionComprador>").append(escapeXml(d.buyerAddress())).append("</direccionComprador>\n");
    }
    xml.append("    <totalSinImpuestos>").append(formatMoney(d.subtotalSinImpuestos())).append("</totalSinImpuestos>\n");
    xml.append("    <totalDescuento>").append(formatMoney(d.totalDiscount())).append("</totalDescuento>\n");

    // totalConImpuestos
    xml.append("    <totalConImpuestos>\n");
    if (d.subtotal15() != null && d.subtotal15().compareTo(BigDecimal.ZERO) > 0) {
      xml.append("      <totalImpuesto>\n");
      xml.append("        <codigo>2</codigo>\n"); // 2 = IVA
      xml.append("        <codigoPorcentaje>4</codigoPorcentaje>\n"); // 4 = 15% IVA Ecuador vigente
      xml.append("        <baseImponible>").append(formatMoney(d.subtotal15())).append("</baseImponible>\n");
      xml.append("        <tarifa>15.00</tarifa>\n");
      xml.append("        <valor>").append(formatMoney(d.iva15Amount())).append("</valor>\n");
      xml.append("      </totalImpuesto>\n");
    }
    if (d.subtotal0() != null && d.subtotal0().compareTo(BigDecimal.ZERO) > 0) {
      xml.append("      <totalImpuesto>\n");
      xml.append("        <codigo>2</codigo>\n"); // 2 = IVA
      xml.append("        <codigoPorcentaje>0</codigoPorcentaje>\n"); // 0 = 0% IVA
      xml.append("        <baseImponible>").append(formatMoney(d.subtotal0())).append("</baseImponible>\n");
      xml.append("        <tarifa>0.00</tarifa>\n");
      xml.append("        <valor>0.00</valor>\n");
      xml.append("      </totalImpuesto>\n");
    }
    // Si no tuvo ni 15 ni 0, poner 0%
    if ((d.subtotal15() == null || d.subtotal15().compareTo(BigDecimal.ZERO) == 0) &&
        (d.subtotal0() == null || d.subtotal0().compareTo(BigDecimal.ZERO) == 0)) {
      xml.append("      <totalImpuesto>\n");
      xml.append("        <codigo>2</codigo>\n");
      xml.append("        <codigoPorcentaje>0</codigoPorcentaje>\n");
      xml.append("        <baseImponible>").append(formatMoney(d.subtotalSinImpuestos())).append("</baseImponible>\n");
      xml.append("        <tarifa>0.00</tarifa>\n");
      xml.append("        <valor>0.00</valor>\n");
      xml.append("      </totalImpuesto>\n");
    }
    xml.append("    </totalConImpuestos>\n");

    xml.append("    <propina>0.00</propina>\n");
    xml.append("    <importeTotal>").append(formatMoney(d.grandTotal())).append("</importeTotal>\n");
    xml.append("    <moneda>DOLAR</moneda>\n");

    // pagos
    xml.append("    <pagos>\n");
    xml.append("      <pago>\n");
    xml.append("        <formaPago>").append(d.sriPaymentMethod() != null ? d.sriPaymentMethod() : "01").append("</formaPago>\n");
    xml.append("        <total>").append(formatMoney(d.grandTotal())).append("</total>\n");
    xml.append("      </pago>\n");
    xml.append("    </pagos>\n");
    xml.append("  </infoFactura>\n");

    // 3. detalles
    xml.append("  <detalles>\n");
    for (ItemDetail item : d.items()) {
      xml.append("    <detalle>\n");
      xml.append("      <codigoPrincipal>").append(escapeXml(item.code())).append("</codigoPrincipal>\n");
      xml.append("      <descripcion>").append(escapeXml(item.description())).append("</descripcion>\n");
      xml.append("      <cantidad>").append(formatQty(item.quantity())).append("</cantidad>\n");
      xml.append("      <precioUnitario>").append(formatMoney(item.unitPrice())).append("</precioUnitario>\n");
      xml.append("      <descuento>").append(formatMoney(item.discount())).append("</descuento>\n");
      xml.append("      <precioTotalSinImpuesto>").append(formatMoney(item.lineTotal())).append("</precioTotalSinImpuesto>\n");
      
      xml.append("      <impuestos>\n");
      xml.append("        <impuesto>\n");
      xml.append("          <codigo>2</codigo>\n");
      if (item.subjectToIva()) {
        BigDecimal itemIva = item.lineTotal().multiply(BigDecimal.valueOf(0.15)).setScale(2, RoundingMode.HALF_UP);
        xml.append("          <codigoPorcentaje>4</codigoPorcentaje>\n");
        xml.append("          <tarifa>15.00</tarifa>\n");
        xml.append("          <baseImponible>").append(formatMoney(item.lineTotal())).append("</baseImponible>\n");
        xml.append("          <valor>").append(formatMoney(itemIva)).append("</valor>\n");
      } else {
        xml.append("          <codigoPorcentaje>0</codigoPorcentaje>\n");
        xml.append("          <tarifa>0.00</tarifa>\n");
        xml.append("          <baseImponible>").append(formatMoney(item.lineTotal())).append("</baseImponible>\n");
        xml.append("          <valor>0.00</valor>\n");
      }
      xml.append("        </impuesto>\n");
      xml.append("      </impuestos>\n");
      xml.append("    </detalle>\n");
    }
    xml.append("  </detalles>\n");

    // 4. infoAdicional
    xml.append("  <infoAdicional>\n");
    if (d.buyerEmail() != null && !d.buyerEmail().isBlank()) {
      xml.append("    <campoAdicional nombre=\"Email\">").append(escapeXml(d.buyerEmail())).append("</campoAdicional>\n");
    }
    if (d.buyerPhone() != null && !d.buyerPhone().isBlank()) {
      xml.append("    <campoAdicional nombre=\"Telefono\">").append(escapeXml(d.buyerPhone())).append("</campoAdicional>\n");
    }
    if (d.buyerAddress() != null && !d.buyerAddress().isBlank()) {
      xml.append("    <campoAdicional nombre=\"Direccion\">").append(escapeXml(d.buyerAddress())).append("</campoAdicional>\n");
    }
    if (d.additionalInfo() != null) {
      for (Map.Entry<String, String> e : d.additionalInfo().entrySet()) {
        if (e.getValue() != null && !e.getValue().isBlank()) {
          xml.append("    <campoAdicional nombre=\"").append(escapeXml(e.getKey())).append("\">")
             .append(escapeXml(e.getValue())).append("</campoAdicional>\n");
        }
      }
    }
    xml.append("  </infoAdicional>\n");

    xml.append("</factura>");
    return xml.toString();
  }

  private static String formatMoney(BigDecimal val) {
    if (val == null) return "0.00";
    return val.setScale(2, RoundingMode.HALF_UP).toString();
  }

  private static String formatQty(BigDecimal val) {
    if (val == null) return "1.00";
    return val.setScale(2, RoundingMode.HALF_UP).toString();
  }

  public static String escapeXml(String s) {
    if (s == null) return "";
    return s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;");
  }
}
