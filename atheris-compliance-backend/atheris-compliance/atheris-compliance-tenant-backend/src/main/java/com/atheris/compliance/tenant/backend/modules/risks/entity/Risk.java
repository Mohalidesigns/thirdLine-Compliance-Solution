package com.atheris.compliance.tenant.backend.modules.risks.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "risks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Risk {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer riskId;

    @Column(name = "risk_code", nullable = false, unique = true)
    private String riskCode;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String riskType;
    private String areaOfFocus;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentBand;
    private Integer ownerId;
    private Integer departmentId;
    private Integer teamId;

    @Builder.Default private String status = "Active";
    @Builder.Default private String source = "toolkit_seed";
    @Builder.Default private Instant createdAt = Instant.now();
    @Builder.Default private Instant updatedAt = Instant.now();

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
