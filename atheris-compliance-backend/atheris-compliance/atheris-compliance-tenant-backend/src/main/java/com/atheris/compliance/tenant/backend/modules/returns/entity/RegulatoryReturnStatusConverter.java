package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RegulatoryReturnStatusConverter implements AttributeConverter<RegulatoryReturnStatus, String> {
    @Override public String convertToDatabaseColumn(RegulatoryReturnStatus s) { return s == null ? null : s.db(); }
    @Override public RegulatoryReturnStatus convertToEntityAttribute(String db) { return db == null ? null : RegulatoryReturnStatus.fromDb(db); }
}