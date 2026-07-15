package com.atheris.tenant.modules.dashboard.entity;

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
    private Integer totalObligationsActive = 0;
    private Integer totalObligationsInapplicable = 0;
    private Integer obligationsHighRisk = 0;
    private Integer obligationsWithGaps = 0;
    private Integer controlsTotal = 0;
    private Integer controlsPassing = 0;
    private Integer controlsFailing = 0;
    private Double controlsTestCompletionRate = 0.0;
    private Integer findingsOpen = 0;
    private Integer findingsHighSeverity = 0;
    private Integer findingsOverdueRemediation = 0;
    private Integer returnsTotal = 0;
    private Integer returnsSubmittedOnTime = 0;
    private Integer returnsSubmittedLate = 0;
    private Integer returnsPending = 0;
    private BigDecimal totalPenaltyExposureNaira = BigDecimal.ZERO;
    private Double complianceScore = 0.0;
}
