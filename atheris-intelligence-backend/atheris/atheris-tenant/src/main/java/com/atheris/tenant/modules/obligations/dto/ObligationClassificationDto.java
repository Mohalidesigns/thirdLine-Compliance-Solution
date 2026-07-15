package com.atheris.tenant.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ObligationClassificationDto {
    private Long instrumentId;
    private String applicability;
    private String applicabilityReasoning;
    private String tenantRiskRating;
    private String riskJustification;
    private Integer assignedOwnerUserId;
    private String assignedOwnerName;
    private List<Integer> linkedControlIds;
    private Boolean hasGap;
    private String gapDescription;
    private Boolean ccoApproved;
    private String status;
    private Integer classificationVersion;
    private Instant classifiedAt;
    private Instant updatedAt;
}
