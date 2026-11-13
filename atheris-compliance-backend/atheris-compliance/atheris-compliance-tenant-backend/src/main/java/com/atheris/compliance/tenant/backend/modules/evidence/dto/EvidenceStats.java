package com.atheris.compliance.tenant.backend.modules.evidence.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class EvidenceStats {
    private long total;
    private Map<String, Long> byCategory;
}