package com.atheris.compliance.tenant.backend.shared.exception;

import com.atheris.compliance.tenant.backend.modules.license.exception.LicenseActivationException;
import com.atheris.compliance.tenant.backend.modules.license.exception.LicenseBlockedException;
import com.atheris.compliance.tenant.backend.modules.license.exception.ProfileNotFoundException;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(LicenseBlockedException.class)
    public ResponseEntity<Map<String, String>> handleLicenseBlocked(LicenseBlockedException e) {
        String msg = e.getMessage();
        if (msg.contains("No license")) {
            return ResponseEntity.status(402)
                .body(Map.of("error", "payment_required", "message", msg));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "license_blocked", "message", msg));
    }

    @ExceptionHandler(LicenseActivationException.class)
    public ResponseEntity<Map<String, String>> handleLicenseActivation(LicenseActivationException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "activation_failed", "message", e.getMessage()));
    }

    @ExceptionHandler(ProfileNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleProfileNotFound(ProfileNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "not_found", "message", e.getMessage()));
    }

    @ExceptionHandler(DocumentUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleDocumentUnavailable(DocumentUnavailableException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "document_unavailable", "message", e.getMessage()));
    }

    @ExceptionHandler(LoginFailedException.class)
    public ResponseEntity<Map<String, String>> handleLoginFailed(LoginFailedException e) {
        return ResponseEntity.status(e.getStatus())
            .body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
        if (e.getStatus().is5xxServerError()) {
            log.error("Request failed ({}): {}", e.getCode(), e.getMessage(), e);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getCode());
        body.put("message", messageOr(e, "Request failed"));
        if (e.getDetails() != null) {
            e.getDetails().forEach(body::putIfAbsent);
        }
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    // @PreAuthorize denials are thrown from the controller proxy, so without this
    // handler they fell through to handleGeneric and surfaced as 500.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "forbidden", "message", "You do not have permission to perform this action."));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "unauthorized", "message", "Authentication required"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining("; "));
        if (msg.isBlank()) msg = "Request validation failed";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "validation_failed", "message", msg));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "malformed_request", "message", "Request body is missing or malformed"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "bad_request", "message", "Invalid value for parameter '" + e.getName() + "'"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, String>> handleMissingParam(MissingServletRequestParameterException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "bad_request", "message", "Missing required parameter '" + e.getParameterName() + "'"));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, String>> handleMissingPart(MissingServletRequestPartException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "bad_request", "message", "Missing required part '" + e.getRequestPartName() + "'"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleUploadTooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(Map.of("error", "file_too_large", "message", "The uploaded file is too large"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNoResource(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "not_found", "message", "No endpoint at /" + e.getResourcePath()));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(Map.of("error", "method_not_allowed", "message", "Method " + e.getMethod() + " is not supported here"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, String>> handleMediaType(HttpMediaTypeNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
            .body(Map.of("error", "unsupported_media_type", "message", "Unsupported content type"));
    }

    // A duplicate key or a dangling foreign key in user-supplied data. The DB message
    // can name tables/constraints, so it is logged, not returned.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException e) {
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("error", "data_conflict", "message", "The request conflicts with existing data"));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleEntityNotFound(EntityNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("error", "not_found", "message", messageOr(e, "Resource not found")));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadArgument(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("error", "bad_request", "message", messageOr(e, "Invalid request")));
    }

    // The client went away mid-response (tab closed, request aborted): nothing to
    // send and nothing wrong server-side, so log at DEBUG. Any other IOException is
    // a real server fault and keeps the generic 500 + ERROR log.
    @ExceptionHandler({ClientAbortException.class, AsyncRequestNotUsableException.class, IOException.class})
    public ResponseEntity<?> handleClientDisconnected(Exception e) {
        if (e instanceof AsyncRequestNotUsableException || isClientDisconnect(e)) {
            log.debug("Client disconnected during response write: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return handleGeneric(e);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception e) {
        if (isClientDisconnect(e)) {
            log.debug("Client disconnected: {}", e.getMessage());
            return null;
        }
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "internal_error", "message", "An unexpected error occurred"));
    }

    private static boolean isClientDisconnect(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t.getClass().getSimpleName().equals("ClientAbortException")) return true;
            String m = t.getMessage();
            if (m != null) {
                String lower = m.toLowerCase();
                if (lower.contains("broken pipe") || lower.contains("connection reset")) return true;
            }
        }
        return false;
    }

    // Map.of rejects null values, so a message-less exception would itself throw.
    private static String messageOr(Exception e, String fallback) {
        String m = e.getMessage();
        return m == null || m.isBlank() ? fallback : m;
    }
}
