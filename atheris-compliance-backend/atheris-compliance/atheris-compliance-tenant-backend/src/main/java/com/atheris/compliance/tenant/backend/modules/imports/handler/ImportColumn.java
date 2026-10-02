package com.atheris.compliance.tenant.backend.modules.imports.handler;

/**
 * One template column. Required columns are suffixed with {@code *} in the template header.
 * {@code text} formats the template column as Text ("@") so Excel keeps values such as
 * {@code 12,345} as typed instead of converting them to a number.
 */
public record ImportColumn(String header, boolean required, boolean text) {
    public ImportColumn(String header, boolean required) { this(header, required, false); }

    public String templateHeader() { return required ? header + "*" : header; }
}
