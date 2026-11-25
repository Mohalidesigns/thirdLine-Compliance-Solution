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
    private String howTested;
    private Integer controlOwnerId;
    private String controlOwnerName;
    private Integer testerOwnerId;
    private Integer testerUserId;
    private String testerName;
    private Long escalationPolicyId;
    private String testFrequency;
    private java.time.LocalDate firstDueDate;
    private List<Long> linkedObligationIds;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
