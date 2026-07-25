package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Data;

@Data
public class AdvanceStageRequest {
    private String evidenceUrl;
    private String completedByName;
}
