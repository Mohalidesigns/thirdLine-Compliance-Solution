package com.atheris.tenant.modules.findings.dto;

import lombok.Data;

@Data
public class SubmitRemediationRequest {
    private String remediationNotes;
    private String evidenceUrl;
}
