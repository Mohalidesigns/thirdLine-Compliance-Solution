package com.atheris.compliance.intelligence.backend.shared.exception;

public class DuplicateUploadException extends UploadException {

    public DuplicateUploadException(String sha256Hash, String title) {
        super("DUPLICATE_UPLOAD", "Duplicate upload: " + title + " (hash=" + sha256Hash + ")");
    }
}
