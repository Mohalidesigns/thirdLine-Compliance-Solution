package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "obligations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Obligation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long obligationId;
    private Long instrumentId;
    private String name;
    private Integer obligationNumber;
    @Column(columnDefinition = "text") private String description;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private LocalDate effectiveDate;
    @Builder.Default private String status = "active";
    @Builder.Default private String source = "ai_extracted";
    @Column(columnDefinition = "text") private String riskDescription;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentRiskRating;
    @Column(columnDefinition = "text") private String controlOwner;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
