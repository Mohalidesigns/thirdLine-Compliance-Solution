package com.atheris.compliance.tenant.backend.modules.imports.dto;

/** A generated spreadsheet ready to stream back to the client. */
public record ImportFile(String fileName, byte[] content) {}
