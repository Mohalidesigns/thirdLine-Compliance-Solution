package com.atheris.tenant.modules.license.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "license_audit_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LicenseAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false, length = 50)
    private String eventType;
    @Column(length = 64)
    private String licenseKey;
    @Column(length = 50)
    private String status;
    @Column(length = 128)
    private String deviceFingerprint;
    @Column(columnDefinition = "jsonb")
    private String responseData;
    @Column(length = 45)
    private String ipAddress;
    @Column(columnDefinition = "TEXT")
    private String userAgent;
    @Column(nullable = false)
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
