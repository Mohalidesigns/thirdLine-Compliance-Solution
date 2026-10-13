package com.atheris.compliance.tenant.backend.modules.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Per-tenant weights for the compliance score (percentages that must sum to 100).
 * One row per tenant; a missing row means the defaults below are used.
 */
@Entity
@Table(name = "compliance_score_weights")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceScoreWeights {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long weightId;

    private Long tenantId;

    @Builder.Default
    private Integer controlCoverage = 30;
    @Builder.Default
    private Integer controlTests = 25;
    @Builder.Default
    private Integer returnsOnTime = 30;
    @Builder.Default
    private Integer findingsWithinSla = 15;

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}