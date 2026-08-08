package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Data;

@Data
public class GapRequest {
    private Boolean hasGap;
    private String gapDescription;
    private String changeReason;
}
