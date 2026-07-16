package com.atheris.compliance.intelligence.backend.modules.tenants.entity;

import com.atheris.compliance.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity @Table(name = "tenants")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Tenant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long tenantId;
    @Column(nullable = false) private String legalName;
    private String shortName;
    @Column(nullable = false) private String licenceType;
    private String licenceNumber;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<Integer> regulators;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> regulatorAbbreviations;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> productLines;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency = Constants.TENANT_PLAN_IMMEDIATE;
    private Integer employeeCount;
    private String stateOfHq;
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
    private String webhookUrl;
    private String webhookSecret;
    private Boolean webhookEnabled = true;
    private String subscriptionTier = Constants.TENANT_PLAN_STARTER;
    private Boolean isActive = true;
    private Integer onboardedBy;
    private Instant onboardedAt;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
