package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ControlDetailResponse {
    private Integer controlId;
    private String controlNumber;
    private String name;
    private String description;
    private String theme;
    private String controlType;
    private String whatItDoes;
    private String howTested;
    private Integer controlOwnerUserId;
    private Integer controlOwnerId;
    private String controlOwnerName;
    private String testFrequency;
    private Integer testFrequencyDays;
    private List<LinkedObligation> linkedObligations;
    private String inherentRisk;
    private String residualRisk;
    private String status;
    private String regulatoryRequirement;
    private String complianceArea;
    private String monitoringActivity;
    private String dueDate;
    private String controlEffectivenessMeasure;
    private Integer actId;
    private String actName;
    private Integer createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;
    private List<TestResultItem> testHistory;
    private LocalDate nextTestDueDate;

    @Data @Builder
    public static class LinkedObligation {
        private Long obligationId;
        private String description;
        private String instrumentTitle;
    }

    @Data @Builder
    public static class TestResultItem {
        private Long testId;
        private LocalDate testDate;
        private Integer testedByUserId;
        private String testedByName;
        private String result;
        private String resultDescription;
        private String failureDetails;
        private String failureSeverity;
        private String evidenceUrl;
        private Boolean remediationRequired;
        private String reviewStatus;
        private Instant createdAt;
    }
}
