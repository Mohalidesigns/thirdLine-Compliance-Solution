package com.atheris.tenant.modules.findings.entity;

import jakarta.persistence.*;
import lombok.*;
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
    private String severity;
    @Column(columnDefinition = "text")
    private String description;
    @Column(columnDefinition = "text")
    private String rootCause;
    private Integer assignedToUserId;
    private String assignedToName;
    private Instant assignedAt;
    private String status = "Open";
    private LocalDate remediationDeadline;
    private Integer slaDays;
    @Column(columnDefinition = "text")
    private String remediationNotes;
    private String remediationEvidenceUrl;
    private Instant remediationSubmittedAt;
    private Integer ccoSignOffUserId;
    private Instant ccoSignOffAt;
    private Instant closedAt;
    private Integer createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
