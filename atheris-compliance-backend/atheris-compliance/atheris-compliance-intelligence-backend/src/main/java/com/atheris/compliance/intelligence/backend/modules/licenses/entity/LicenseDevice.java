package com.atheris.compliance.intelligence.backend.modules.licenses.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "license_devices")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LicenseDevice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false)
    private Integer licenseId;
    @Column(nullable = false, length = 128)
    private String deviceFingerprint;
    @Column(length = 255)
    private String deviceLabel;
    @Column(nullable = false)
    private Instant lastSeenAt;
    @Column(length = 45)
    private String lastIpAddress;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = lastSeenAt = Instant.now(); }
}
