package com.atheris.tenant.modules.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "tenant_profile")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer profileId;
    @Column(nullable = false)
    private Long tenantId;
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
    private List<Integer> subscribedRegulators;
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

    private String licenseKey;
    private String licenseStatus = "inactive";
    private Instant licenseActivatedAt;
    private Instant licenseExpiresAt;
    private Boolean intelligenceEnabled = true;
    private String deviceFingerprint;
    private Instant deviceFingerprintProvisionedAt;
    private Instant lastLicenseCheckupAt;
    private Instant licenseGracePeriodEnd;
    private String authType = "local";
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> ldapConfig;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
