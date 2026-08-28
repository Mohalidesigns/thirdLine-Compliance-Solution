package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "compliance_controls")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ComplianceControl {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "compliance_control_id")
    private Long complianceControlId;

    @Column(nullable = false, unique = true, length = 100)
    private String controlNumber;

    private String theme;

    @Column(columnDefinition = "text")
    private String regulatoryRequirement;

    @Column(length = 255)
    private String complianceArea;

    @Column(length = 50)
    private String riskLevel;

    @Column(columnDefinition = "text")
    private String complianceControl;

    @Column(columnDefinition = "text")
    private String monitoringActivity;

    @Column(length = 50)
    private String frequency;

    @Column(length = 255)
    private String responsibleOfficer;

    @Column(length = 100)
    private String dueDate;

    @Column(length = 50)
    @Builder.Default
    private String status = "Open";

    @Column(columnDefinition = "text")
    private String controlEffectivenessMeasure;

    @Column(name = "act_id")
    private Long actId;

    @Column(name = "act_name", length = 500)
    private String actName;

    @Column(name = "obligation_id")
    private Long obligationId;

    @Column(length = 50)
    @Builder.Default
    private String controlType = "PRIMARY";

    @Column(length = 50)
    private String residualLikelihood;

    @Column(length = 50)
    private String residualImpact;

    @Column(length = 50)
    private String residualRiskRating;

    @Column(columnDefinition = "text")
    private String ownerName;

    @Column(columnDefinition = "text")
    private String linkedObligationIds;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }
}
