package com.atheris.platform.modules.licenses.exception;

public class LicenseNotFoundException extends RuntimeException {
    public LicenseNotFoundException(String message) {
        super(message);
    }
    public LicenseNotFoundException(Integer id) {
        super("License not found: " + id);
    }
    public LicenseNotFoundException(String key, String type) {
        super("License not found: " + key);
    }
}
