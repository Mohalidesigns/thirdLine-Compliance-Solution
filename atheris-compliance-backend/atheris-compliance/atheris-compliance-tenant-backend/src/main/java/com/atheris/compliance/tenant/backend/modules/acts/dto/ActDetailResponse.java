package com.atheris.compliance.tenant.backend.modules.acts.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ActDetailResponse {
    private Integer actId;
    private Long regulationId;
    private String name;
    private String abbreviation;
    private String regulatorName;
    private Long canonicalInstrumentId;
    private long obligationCount;
    private long controlCount;
    private long returnCount;
    private long sanctionCount;
}
