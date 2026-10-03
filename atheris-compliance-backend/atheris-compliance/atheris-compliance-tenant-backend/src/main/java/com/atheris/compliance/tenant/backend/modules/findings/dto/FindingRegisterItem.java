package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Data @Builder
public class FindingRegisterItem {
    private Long findingId;
    private String displayId;
    private String findingType;
    private String severity;
    private String description;
    private String assignedToName;
    private String status;
    private LocalDate remediationDeadline;
    private Integer slaDays;
    private Long slaRemainingDays;
    private String externalReference;
    /** The linked control's control number (e.g. CTL-0001), null when unlinked or the control is gone. */
    private String linkedControlIdentifier;
    private String linkedObligationDescription;

    /** {@code linkedControlNumber} is resolved by the caller (batch-loaded once per page). */
    public static FindingRegisterItem from(com.atheris.compliance.tenant.backend.modules.findings.entity.Finding f,
                                           String linkedControlNumber) {
        long remaining = 0;
        if (f.getRemediationDeadline() != null && !"Closed".equals(f.getStatus())) {
            remaining = LocalDate.now().until(f.getRemediationDeadline(), ChronoUnit.DAYS);
        }
        return FindingRegisterItem.builder()
            .findingId(f.getFindingId())
            .displayId("FIND-" + String.format("%03d", f.getFindingId()))
            .findingType(f.getFindingType()).severity(f.getSeverity())
            .description(f.getDescription()).assignedToName(f.getAssignedToName())
            .status(f.getStatus()).remediationDeadline(f.getRemediationDeadline())
            .slaDays(f.getSlaDays()).slaRemainingDays(Math.max(remaining, 0))
            .externalReference(f.getExternalReference())
            .linkedControlIdentifier(linkedControlNumber)
            .linkedObligationDescription(null)
            .build();
    }
}
