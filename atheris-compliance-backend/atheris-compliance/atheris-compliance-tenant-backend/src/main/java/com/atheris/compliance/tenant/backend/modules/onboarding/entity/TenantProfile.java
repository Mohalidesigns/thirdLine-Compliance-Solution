package com.atheris.compliance.tenant.backend.modules.onboarding.entity;

import static com.atheris.compliance.common.Constants.*;

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
    private String legalName;
    private String shortName;
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
    @Builder.Default
    private String notificationFrequency = "immediate";
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
    private String address;
    private String contactPhone;
    private String contactEmail;
    private String webhookUrl;
    @Builder.Default
    private Boolean webhookEnabled = true;
    @Builder.Default
    private String subscriptionTier = "starter";
    @Builder.Default
    private Boolean isActive = true;
    @Builder.Default
    private Integer onboardingStep = 1;
    private Instant onboardingCompletedAt;

    private String licenseKey;
    @Builder.Default
    private String licenseStatus = LICENSE_INACTIVE;
    private String encryptedApiKey;
    private String apiKeyPrefix;
    private Instant licenseActivatedAt;
    private Instant licenseExpiresAt;
    @Builder.Default
    private Boolean intelligenceEnabled = true;
    private String deviceFingerprint;
    private Instant deviceFingerprintProvisionedAt;
    private Instant lastLicenseCheckupAt;
    private Instant licenseGracePeriodEnd;
    @Builder.Default
    private String authType = "local";
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> ldapConfig;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
