package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class ObligationRegisterItem {
    private Long instrumentId;
    private Long obligationId;
    private String sourceTitle;
    private String regulatorAbbreviation;
    private String obligationDescription;
    private Integer obligationNumber;
    private String tenantRiskRating;
    private String assignedOwnerName;
    private String status;
    private Boolean hasGap;
    private String inherentRiskRating;
    private Integer classificationVersion;
    private Instant classifiedAt;
    private Instant updatedAt;
}
