package com.atheris.compliance.intelligence.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "obligation_mappings")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationMapping {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long obligationId;
    @Column(nullable = false) private Long instrumentId;
    @Column(name = "act_id") private Long regulationId;
    private Integer obligationNumber;
    @Column(columnDefinition = "text", nullable = false) private String plainEnglishStatement;
    private String specificSectionReference;
    private String areaOfFocus;
    private String obligationType;          // Operational | Reporting | Governance | One-time
    private String recurringDeadlineType;   // Continuous | Daily | Monthly | Annual | One-time
    private Integer complianceDeadlineDays;
    private String riskDescription;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentRiskRating;
    private String controlOwner;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
