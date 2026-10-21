package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class SetReturnEscalationPolicyRequest {
    private Long escalationPolicyId;
}
