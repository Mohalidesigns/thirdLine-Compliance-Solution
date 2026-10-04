package com.atheris.compliance.tenant.backend.shared.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * A client-facing failure with a stable {@code error} code and a human-readable
 * message. {@link GlobalExceptionHandler} renders it as
 * {@code {"error": code, "message": message}} (plus any {@code details} fields) with the given status, so a routine
 * client-side condition (missing record, bad input, state conflict) never reaches
 * the generic 500 handler.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    /** Extra top-level body fields (e.g. {@code rowErrors}); null or empty for the plain shape. */
    private final Map<String, Object> details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, (Map<String, Object>) null);
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public ApiException(HttpStatus status, String code, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.code = code;
        this.details = null;
    }

    /** 404 — the referenced record does not exist. */
    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", message);
    }

    /** 400 — the request itself is invalid. */
    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "bad_request", message);
    }

    /** 400 with a specific code, e.g. {@code weak_password}. */
    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    /** 400 with a specific code and extra body fields, e.g. {@code rowErrors}. */
    public static ApiException badRequest(String code, String message, Map<String, Object> details) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message, details);
    }

    /** 409 — the request conflicts with the record's current state. */
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "conflict", message);
    }

    /** 409 with a specific code, e.g. {@code already_exists}. */
    public static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    /** 401 with a specific code — the presented token/credential is not acceptable. */
    public static ApiException unauthorized(String code, String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
    }

    /** 403 — authenticated but not permitted. */
    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "forbidden", message);
    }

    /** 410 with a specific code — a link/token that existed but is no longer usable. */
    public static ApiException gone(String code, String message) {
        return new ApiException(HttpStatus.GONE, code, message);
    }

    /** 502 — the upstream platform failed or is unreachable. */
    public static ApiException badGateway(String message, Throwable cause) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "platform_unavailable", message, cause);
    }
}
