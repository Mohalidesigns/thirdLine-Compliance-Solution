package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantRegulatorDto {
    private Long id;
    private String name;
    private String abbreviation;
    private Integer platformRegulatorId;
    private String description;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
    private Long obligationCount;
    private Long returnCount;
    private Long sanctionCount;
}
