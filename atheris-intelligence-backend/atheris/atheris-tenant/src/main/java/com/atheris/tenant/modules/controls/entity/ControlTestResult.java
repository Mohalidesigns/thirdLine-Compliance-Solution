package com.atheris.tenant.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "control_test_results")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControlTestResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long testId;
    @Column(nullable = false)
    private Integer controlId;
    private LocalDate testDate;
    private Integer testedByUserId;
    private String testedByName;
    private String result;
    @Column(columnDefinition = "text")
    private String resultDescription;
    @Column(columnDefinition = "text")
    private String failureDetails;
    private String failureSeverity;
    private String evidenceUrl;
    private Boolean remediationRequired = false;
    private Integer remediationOwnerUserId;
    private LocalDate remediationDeadline;
    private String reviewStatus = "Pending";
    private Integer reviewedByUserId;
    private String reviewedByName;
    private String reviewNotes;
    private Instant reviewedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
