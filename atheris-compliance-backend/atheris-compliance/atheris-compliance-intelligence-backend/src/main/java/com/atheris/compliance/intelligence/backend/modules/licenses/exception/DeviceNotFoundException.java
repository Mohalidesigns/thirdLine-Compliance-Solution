package com.atheris.compliance.intelligence.backend.modules.licenses.exception;

public class DeviceNotFoundException extends RuntimeException {
    public DeviceNotFoundException(Integer deviceId) {
        super("Device not found: " + deviceId);
    }
}
