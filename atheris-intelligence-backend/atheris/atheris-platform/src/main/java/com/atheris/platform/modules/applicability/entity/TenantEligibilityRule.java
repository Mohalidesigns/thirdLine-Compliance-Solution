package com.atheris.platform.modules.applicability.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "tenant_eligibility_rules")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantEligibilityRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long ruleId;
    @Column(nullable = false) private Long instrumentId;
    @Column(columnDefinition = "text") private String ruleCondition;
    private Integer targetTenantCount;
    private Boolean shouldRoute = true;
    private String routeWithConfidenceLevel; // High | Medium | Low
    private Boolean routeWithReviewFlag = false;
    private Instant lastEvaluatedAt;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
