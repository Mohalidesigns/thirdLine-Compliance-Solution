package com.atheris.tenant.modules.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class InstitutionDetailsRequest {
    @NotBlank private String legalName;
    private String shortName;
    @NotBlank private String licenceType;
    private String licenceNumber;
    private String stateOfHq;
    private Integer employeeCount;
    private List<String> productLines;
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
}
