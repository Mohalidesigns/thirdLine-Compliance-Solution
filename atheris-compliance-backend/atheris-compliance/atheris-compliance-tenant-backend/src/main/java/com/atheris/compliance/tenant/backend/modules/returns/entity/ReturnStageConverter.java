package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ReturnStageConverter implements AttributeConverter<ReturnStage, String> {
    @Override public String convertToDatabaseColumn(ReturnStage s) { return s == null ? null : s.db(); }
    @Override public ReturnStage convertToEntityAttribute(String db) { return db == null ? null : ReturnStage.fromDb(db); }
}