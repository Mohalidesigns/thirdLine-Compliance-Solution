package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ControlDto {
    private Integer controlId;
    private String controlNumber;
    private String name;
    private String description;
    private String theme;
    private String controlType;
    private String whatItDoes;
    private String howTested;
    private Integer controlOwnerUserId;
    private String controlOwnerName;
    private String testFrequency;
    private Integer testFrequencyDays;
    private List<Long> linkedObligationIds;
    private String inherentRisk;
    private String residualRisk;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
