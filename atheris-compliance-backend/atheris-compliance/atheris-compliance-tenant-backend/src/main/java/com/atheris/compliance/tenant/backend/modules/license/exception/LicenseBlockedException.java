package com.atheris.compliance.tenant.backend.modules.license.exception;

public class LicenseBlockedException extends RuntimeException {
    public LicenseBlockedException(String message) {
        super(message);
    }
}
