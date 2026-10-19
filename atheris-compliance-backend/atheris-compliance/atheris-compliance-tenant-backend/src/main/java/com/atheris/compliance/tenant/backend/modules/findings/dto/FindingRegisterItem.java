package com.atheris.compliance.tenant.backend.modules.findings.dto;

import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
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
    private String linkedControlIdentifier;
    private Long linkedObligationId;
    private String linkedObligationDescription;

    public static FindingRegisterItem from(com.atheris.compliance.tenant.backend.modules.findings.entity.Finding f,
                                           String linkedControlNumber) {
        long remaining = 0;
        if (f.getRemediationDeadline() != null && !WorkflowStatus.FINDING_CLOSED.equals(f.getStatus())) {
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
            .linkedObligationId(f.getLinkedObligationId())
            .linkedObligationDescription(null)
            .build();
    }
}
