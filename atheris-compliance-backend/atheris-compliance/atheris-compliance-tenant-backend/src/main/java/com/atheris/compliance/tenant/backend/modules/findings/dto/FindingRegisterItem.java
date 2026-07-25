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
    private String linkedControlIdentifier;
    private String linkedObligationDescription;

    public static FindingRegisterItem from(com.atheris.compliance.tenant.backend.modules.findings.entity.Finding f) {
        long remaining = 0;
        if (f.getRemediationDeadline() != null && !"Closed".equals(f.getStatus())) {
            remaining = LocalDate.now().until(f.getRemediationDeadline(), ChronoUnit.DAYS);
        }
        String ctrlId = f.getLinkedControlId() != null ? "CTRL-" + String.format("%03d", f.getLinkedControlId()) : null;
        return FindingRegisterItem.builder()
            .findingId(f.getFindingId())
            .displayId("FIND-" + String.format("%03d", f.getFindingId()))
            .findingType(f.getFindingType()).severity(f.getSeverity())
            .description(f.getDescription()).assignedToName(f.getAssignedToName())
            .status(f.getStatus()).remediationDeadline(f.getRemediationDeadline())
            .slaDays(f.getSlaDays()).slaRemainingDays(Math.max(remaining, 0))
            .linkedControlIdentifier(ctrlId)
            .linkedObligationDescription(null)
            .build();
    }
}
