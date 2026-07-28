package com.atheris.compliance.intelligence.backend.shared.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidFileException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidFile(InvalidFileException e) {
        return build(HttpStatus.BAD_REQUEST, e.getErrorCode(), e.getMessage());
    }

    @ExceptionHandler(DuplicateUploadException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateUpload(DuplicateUploadException e) {
        return build(HttpStatus.CONFLICT, e.getErrorCode(), e.getMessage());
    }

    @ExceptionHandler(UploadException.class)
    public ResponseEntity<Map<String, Object>> handleUpload(UploadException e) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, e.getErrorCode(), e.getMessage());
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("status", status.value());
        return ResponseEntity.status(status).body(body);
    }
}
