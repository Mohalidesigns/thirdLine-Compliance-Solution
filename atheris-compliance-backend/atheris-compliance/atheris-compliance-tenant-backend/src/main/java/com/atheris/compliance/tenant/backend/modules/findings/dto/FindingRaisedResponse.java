package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data @AllArgsConstructor
public class FindingRaisedResponse {
    private Long findingId;
    private String status;
}
