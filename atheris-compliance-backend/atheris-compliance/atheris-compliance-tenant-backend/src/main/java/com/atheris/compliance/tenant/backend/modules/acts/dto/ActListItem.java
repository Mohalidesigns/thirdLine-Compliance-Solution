package com.atheris.compliance.tenant.backend.modules.acts.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ActListItem {
    private Integer actId;
    private String name;
    private String abbreviation;
    private String regulatorName;
    private long obligationCount;
    private long controlCount;
    private long returnCount;
    private long sanctionCount;
}
