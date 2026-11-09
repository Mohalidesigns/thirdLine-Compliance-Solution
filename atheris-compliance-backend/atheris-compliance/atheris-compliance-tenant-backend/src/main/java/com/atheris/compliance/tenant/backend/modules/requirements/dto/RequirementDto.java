package com.atheris.compliance.tenant.backend.modules.requirements.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data @Builder @JsonIgnoreProperties(ignoreUnknown = true)
public class RequirementDto {
    private Long requirementId;
    private Long obligationId;
    private String obligationTitle;
    private String actName;
    private Integer ordinal;
    private String text;
    private String state;
    private boolean gap;
    private String stateOverride;
    private String overrideReason;
    private Integer riskId;
    private String riskCode;
    private String riskName;
    private String riskBand;
    private String source;
    @Builder.Default private List<ControlRef> controls = List.of();
    private Instant updatedAt;

    @Data @Builder
    public static class ControlRef {
        private Integer controlId;
        private String controlNumber;
        private String name;
        private String latestResult;
        private java.time.LocalDate latestTestDate;
        private boolean effective;
    }
}
