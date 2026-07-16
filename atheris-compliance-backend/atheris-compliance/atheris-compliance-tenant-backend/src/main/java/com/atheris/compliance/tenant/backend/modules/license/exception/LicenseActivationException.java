package com.atheris.compliance.tenant.backend.modules.license.exception;

public class LicenseActivationException extends RuntimeException {
    public LicenseActivationException(String message) {
        super("License activation failed: " + message);
    }
}
