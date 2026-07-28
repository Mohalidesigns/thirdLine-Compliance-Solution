package com.atheris.compliance.intelligence.backend.shared.exception;

public class InvalidFileException extends UploadException {

    public InvalidFileException(String message) {
        super("INVALID_FILE", message);
    }
}
