package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ReturnFilingStatusConverter implements AttributeConverter<ReturnFilingStatus, String> {
    @Override public String convertToDatabaseColumn(ReturnFilingStatus s) { return s == null ? null : s.db(); }
    @Override public ReturnFilingStatus convertToEntityAttribute(String db) { return db == null ? null : ReturnFilingStatus.fromDb(db); }
}