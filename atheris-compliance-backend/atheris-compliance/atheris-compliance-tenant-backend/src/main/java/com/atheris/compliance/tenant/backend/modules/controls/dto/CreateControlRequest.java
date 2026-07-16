package com.atheris.compliance.tenant.backend.modules.controls.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class CreateControlRequest {
    @NotBlank private String controlNumber;
    @NotBlank private String name;
    private String description;
    private String theme;
    private String controlType;
    private String whatItDoes;
    private String howTested;
    private Integer controlOwnerUserId;
    private String testFrequency;
    private Integer testFrequencyDays;
    private List<Long> linkedObligationIds;
    private String inherentRisk;
}
