package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data @Builder
public class ControlRegisterItem {
    private Integer controlId;
    private String controlNumber;
    private String name;
    /** Alias of {@link #name} so the shared intel control column can bind. */
    private String controlSummary;
    private String theme;
    private String controlOwnerName;
    private Integer testerOwnerId;
    private Integer testerUserId;
    private String testerName;
    private Long escalationPolicyId;
    private String controlType;
    private String status;
    private LocalDate nextTestDueDate;
    private String lastTestResult;
    private LocalDate lastTestDate;
    private String lastTestReviewStatus;
    private Long openFindings;
    private String effectivenessState;
    private String effectivenessReason;
    private String frequency;
}
