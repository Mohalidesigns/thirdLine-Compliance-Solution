package com.atheris.compliance.intelligence.backend.shared.exception;

public class DocumentUnavailableException extends ResourceNotFoundException {

    public DocumentUnavailableException(String message) {
        super("DOCUMENT_UNAVAILABLE", message);
    }
}
