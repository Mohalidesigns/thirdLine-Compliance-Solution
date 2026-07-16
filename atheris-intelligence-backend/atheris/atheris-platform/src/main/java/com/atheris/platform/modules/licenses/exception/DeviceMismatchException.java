package com.atheris.platform.modules.licenses.exception;

public class DeviceMismatchException extends RuntimeException {
    public DeviceMismatchException(Integer deviceId, Integer licenseId) {
        super("Device " + deviceId + " does not belong to license " + licenseId);
    }
}
