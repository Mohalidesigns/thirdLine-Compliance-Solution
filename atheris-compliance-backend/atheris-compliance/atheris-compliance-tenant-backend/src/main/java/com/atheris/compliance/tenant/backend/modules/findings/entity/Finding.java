package com.atheris.compliance.tenant.backend.modules.findings.entity;

import jakarta.persistence.*;
import lombok.*;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "findings")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Finding {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long findingId;
    private Long triggeredByTestId;
    private String triggerReason;
    private String findingType;
    private Long linkedObligationId;
    private Integer linkedControlId;
    /** Optional external id (e.g. an audit report reference); unique case-insensitively when set. */
    @Column(length = 100)
    private String externalReference;
    private String severity;
    @Column(columnDefinition = "text")
    private String description;
    private Integer assignedToUserId;
    private String assignedToName;
    private Integer assignedToOwnerId;
    private Instant assignedAt;
    @Builder.Default
    private String status = WorkflowStatus.FINDING_OPEN;
    private LocalDate remediationDeadline;
    private Integer slaDays;
    @Column(columnDefinition = "text")
    private String remediationNotes;
    private String remediationEvidenceUrl;
    private Instant remediationSubmittedAt;
    private Integer remediationSubmittedByUserId;
    @Builder.Default
    private Boolean remediationSubmittedViaLink = false;
    private Integer remediationSubmittedByOwnerId;
    @Column(columnDefinition = "text")
    private String reviewNotes;
    @Column(name = "signed_off_by_user_id")
    private Integer signedOffByUserId;
    @Column(name = "signed_off_at")
    private Instant signedOffAt;
    private Instant closedAt;
    private Integer createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        // An import supplies its historical Date Raised; everything else is stamped now.
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
