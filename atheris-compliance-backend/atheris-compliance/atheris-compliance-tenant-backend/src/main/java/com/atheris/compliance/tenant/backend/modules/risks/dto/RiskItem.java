package com.atheris.compliance.tenant.backend.modules.risks.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class RiskItem {
    private Integer riskId;
    private String riskCode;
    private String name;
    private String description;
    private String riskType;
    private String areaOfFocus;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentBand;
    private String status;
    private Integer obligationCount;
    private Integer requirementCount;
    private Integer controlCount;
    private Integer uncoveredRequirementCount;
    @Builder.Default private List<ObligationRef> obligations = List.of();
    @Builder.Default private List<ControlRef> controls = List.of();

    @Data @Builder
    public static class ObligationRef {
        private Long obligationId;
        private String title;
        private String actName;
        private String riskRating;
    }

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
