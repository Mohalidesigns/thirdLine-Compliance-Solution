package com.atheris.compliance.tenant.backend.modules.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InviteValidationResult {
    private String email;
    private String fullName;
    private String role;
    private Boolean tokenValid;
}
