package com.atheris.compliance.tenant.backend.modules.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "dashboard_snapshots")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long snapshotId;
    @Column(nullable = false)
    private LocalDate snapshotDate;
    private Instant computedAt;
    @Builder.Default
    private Integer totalObligationsActive = 0;
    @Builder.Default
    private Integer totalObligationsInapplicable = 0;
    @Builder.Default
    private Integer obligationsHighRisk = 0;
    @Builder.Default
    private Integer obligationsWithGaps = 0;
    @Builder.Default
    private Integer controlsTotal = 0;
    @Builder.Default
    private Integer controlsPassing = 0;
    @Builder.Default
    private Integer controlsFailing = 0;
    @Builder.Default
    private Double controlsTestCompletionRate = 0.0;
    @Builder.Default
    private Integer findingsOpen = 0;
    @Builder.Default
    private Integer findingsHighSeverity = 0;
    @Builder.Default
    private Integer findingsOverdueRemediation = 0;
    @Builder.Default
    private Integer returnsTotal = 0;
    @Builder.Default
    private Integer returnsSubmittedOnTime = 0;
    @Builder.Default
    private Integer returnsSubmittedLate = 0;
    @Builder.Default
    private Integer returnsPending = 0;
    @Builder.Default
    private BigDecimal totalPenaltyExposureNaira = BigDecimal.ZERO;
    private Double complianceScore;
}
