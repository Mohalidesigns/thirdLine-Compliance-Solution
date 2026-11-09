package com.atheris.compliance.tenant.backend.modules.requirements.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data @JsonIgnoreProperties(ignoreUnknown = true)
public class StateOverrideRequest {
    /** COMPLIANT / PARTIAL / NON_COMPLIANT, or blank to clear the override. */
    private String state;
    private String reason;
}
