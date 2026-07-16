package com.atheris.compliance.intelligence.backend.modules.licenses.entity;

import static com.atheris.compliance.common.Constants.*;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "licenses")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class License {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false)
    private Long tenantId;
    @Column(nullable = false, unique = true, length = 64)
    private String licenseKey;
    @Column(nullable = false, length = 50)
    private String tier = LICENSE_DEFAULT_TIER;
    @Column(nullable = false)
    private Boolean intelligenceEnabled = true;
    @Column(nullable = false)
    private Integer maxUsers = 5;
    @Column(nullable = false)
    private Integer maxDevices = 1;
    private Integer maxRegulators;
    private Integer maxControls;
    private Integer maxReturns;
    private Integer maxStorageMb = 500;
    @Column(nullable = false)
    private Boolean deviceFingerprintEnforced = true;
    @Column(nullable = false, length = 50)
    private String status = LICENSE_INACTIVE;
    private Instant activatedAt;
    @Column(nullable = false)
    private Instant expiresAt;
    @Column(nullable = false)
    private Integer gracePeriodDays = 7;
    private Instant gracePeriodEnd;
    private Integer issuedBy;
    @Column(columnDefinition = "TEXT")
    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
