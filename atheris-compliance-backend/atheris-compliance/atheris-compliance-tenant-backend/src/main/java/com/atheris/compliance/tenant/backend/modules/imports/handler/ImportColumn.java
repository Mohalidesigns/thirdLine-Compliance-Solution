package com.atheris.compliance.tenant.backend.modules.imports.handler;

/** One template column. Required columns are suffixed with {@code *} in the template header. */
public record ImportColumn(String header, boolean required) {
    public String templateHeader() { return required ? header + "*" : header; }
}
