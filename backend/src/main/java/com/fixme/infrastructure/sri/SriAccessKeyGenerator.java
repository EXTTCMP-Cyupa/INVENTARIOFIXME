package com.fixme.infrastructure.sri;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

public final class SriAccessKeyGenerator {

  private SriAccessKeyGenerator() {}

  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("ddMMyyyy");

  /**
   * Generates a 49-digit SRI access key (Clave de Acceso) according to the official SRI Ecuador technical specs.
   *
   * @param emissionDate Date of emission
   * @param documentType "01" (Factura), "04" (Nota de Credito), etc.
   * @param ruc 13-digit emitter RUC
   * @param environment 1 for Test/Sandbox, 2 for Production
   * @param establishment 3-digit establishment code (e.g. "001")
   * @param emissionPoint 3-digit emission point code (e.g. "001")
   * @param sequential 9-digit sequential number (e.g. "000000042")
   * @param numericCode 8-digit random security code (or null to auto-generate)
   * @return 49-digit valid SRI Access Key
   */
  public static String generate(
      LocalDate emissionDate,
      String documentType,
      String ruc,
      int environment,
      String establishment,
      String emissionPoint,
      String sequential,
      String numericCode
  ) {
    String dateStr = (emissionDate != null ? emissionDate : LocalDate.now()).format(DATE_FORMATTER);
    String docTypeStr = String.format("%02d", Integer.parseInt(documentType.trim()));
    String rucClean = String.format("%-13s", ruc.replaceAll("[^0-9]", "")).replace(' ', '0');
    if (rucClean.length() > 13) rucClean = rucClean.substring(0, 13);
    
    String envStr = String.valueOf(environment == 2 ? 2 : 1);
    String series = String.format("%03d%03d",
        Integer.parseInt(establishment.replaceAll("[^0-9]", "")),
        Integer.parseInt(emissionPoint.replaceAll("[^0-9]", ""))
    );
    String seqStr = String.format("%09d", Long.parseLong(sequential.replaceAll("[^0-9]", "")));
    
    String codeStr;
    if (numericCode != null && numericCode.matches("\\d{8}")) {
      codeStr = numericCode;
    } else {
      codeStr = String.format("%08d", ThreadLocalRandom.current().nextInt(10000000, 99999999));
    }
    
    String emissionType = "1"; // 1 = Emision Normal

    String base48 = dateStr + docTypeStr + rucClean + envStr + series + seqStr + codeStr + emissionType;
    int checkDigit = calculateModulo11(base48);

    return base48 + checkDigit;
  }

  /**
   * Official SRI Ecuador Modulo 11 check digit algorithm (weights 2,3,4,5,6,7 from right to left).
   */
  public static int calculateModulo11(String base48) {
    int factor = 2;
    int sum = 0;
    for (int i = base48.length() - 1; i >= 0; i--) {
      int digit = Character.getNumericValue(base48.charAt(i));
      sum += digit * factor;
      factor++;
      if (factor > 7) {
        factor = 2;
      }
    }
    int mod = sum % 11;
    int check = 11 - mod;
    if (check == 11) {
      return 0;
    }
    if (check == 10) {
      return 1;
    }
    return check;
  }

  public static boolean isValid(String accessKey) {
    if (accessKey == null || accessKey.length() != 49 || !accessKey.matches("\\d{49}")) {
      return false;
    }
    String base48 = accessKey.substring(0, 48);
    int expectedCheck = calculateModulo11(base48);
    int actualCheck = Character.getNumericValue(accessKey.charAt(48));
    return expectedCheck == actualCheck;
  }
}
