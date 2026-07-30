package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ConfirmedObligation {
    private Integer obligationNumber;
    private String description;
    private String sectionReference;
    private String obligationType;
    private String recurringDeadlineType;
    private Boolean applicable;
}
