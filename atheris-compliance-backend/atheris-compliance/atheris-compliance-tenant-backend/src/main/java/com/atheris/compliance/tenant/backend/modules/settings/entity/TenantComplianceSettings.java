package com.atheris.compliance.tenant.backend.modules.settings.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "tenant_compliance_settings")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantComplianceSettings {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long tenantId;

    @Builder.Default private Integer residualAllDrop = 2;
    @Builder.Default private Integer residualMajorityDrop = 1;
    @Builder.Default private String residualAxis = "LIKELIHOOD";
    @Builder.Default private String residualTarget = "Passed";
    @Builder.Default private Integer residualFloor = 1;

    @Builder.Default private Integer controlDueSoonDays = 30;
    @Builder.Default private Integer findingDueSoonDays = 7;

    @Builder.Default private Integer slaCriticalDays = 1;
    @Builder.Default private Integer slaHighDays = 14;
    @Builder.Default private Integer slaMediumDays = 30;
    @Builder.Default private Integer slaLowDays = 60;

    @Builder.Default private Boolean requireControlTestReview = true;
    @Builder.Default private Boolean requireFindingReview = true;

    private String complianceTeamEmail;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
