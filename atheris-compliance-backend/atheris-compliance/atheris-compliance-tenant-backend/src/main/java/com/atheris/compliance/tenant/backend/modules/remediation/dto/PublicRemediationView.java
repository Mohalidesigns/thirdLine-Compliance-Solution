package com.atheris.compliance.tenant.backend.modules.remediation.dto;

import lombok.*;

import java.time.LocalDate;

/** Sanitised finding view shown on the public (no-login) remediation page. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicRemediationView {
    private Long findingId;
    private String institutionName;
    private String description;
    private String findingType;
    private String severity;
    private String controlNumber;
    private LocalDate remediationDeadline;
    private String status;
    private String ownerName;
    private boolean editable;   // false when the finding is already approved/closed
}