package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.Data;

@Data
public class SubmitRemediationRequest {
    private String remediationNotes;
    private String evidenceUrl;
}
