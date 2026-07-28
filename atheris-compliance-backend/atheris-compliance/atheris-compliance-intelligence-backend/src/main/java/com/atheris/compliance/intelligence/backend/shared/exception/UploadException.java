package com.atheris.compliance.intelligence.backend.shared.exception;

public class UploadException extends RuntimeException {

    private final String errorCode;

    public UploadException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public UploadException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
