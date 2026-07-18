package com.atheris.compliance.intelligence.backend.modules.licenses.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "api_keys")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApiKey {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private Integer licenseId;

    private Long tenantId;

    @Column(nullable = false, length = 64)
    private String keyHash;

    @Column(nullable = false, length = 16)
    private String keyPrefix;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String encryptedKey;

    @Column(length = 100)
    private String label;

    private Boolean isActive = true;

    private Instant lastUsedAt;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
