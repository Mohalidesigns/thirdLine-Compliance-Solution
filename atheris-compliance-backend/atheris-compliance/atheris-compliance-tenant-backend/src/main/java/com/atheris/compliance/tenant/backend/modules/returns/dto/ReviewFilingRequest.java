package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;

@Data
public class ReviewFilingRequest {
    private String decision;
    private String notes;
}
