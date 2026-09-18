package com.fixme.infrastructure.web;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String,String>> bad(IllegalArgumentException e) {
    return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() == null ? "Solicitud inválida" : e.getMessage()));
  }
  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<Map<String,String>> conflict(DataIntegrityViolationException e) {
    log.error("Data integrity violation", e);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "El SKU ya existe o la sucursal/producto no es válido"));
  }
}
