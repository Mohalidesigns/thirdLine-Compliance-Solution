package com.atheris.compliance.intelligence.backend.shared.storage;

public class PdfTooLargeException extends RuntimeException {
    public PdfTooLargeException(String message) { super(message); }
}
