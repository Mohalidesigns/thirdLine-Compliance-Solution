package com.atheris.tenant.modules.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "tenant_profile")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer profileId;
    @Column(nullable = false)
    private String tenantId;
    @Column(nullable = false)
    private String legalName;
    private String shortName;
    @Column(nullable = false)
    private String licenceType;
    private String licenceNumber;
    private String stateOfHq;
    private Integer employeeCount;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> subscribedRegulators;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> subscribedDocumentTypes;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> notificationRiskRatings;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> productLines;
    private String notificationFrequency = "immediate";
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
    private String webhookUrl;
    private Boolean webhookEnabled = true;
    private String subscriptionTier = "starter";
    private Boolean isActive = true;
    private Integer onboardingStep = 1;
    private Instant onboardingCompletedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
