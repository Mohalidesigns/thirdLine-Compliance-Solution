package com.atheris.tenant.modules.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer tokenId;
    @Column(nullable = false)
    private Integer userId;
    @Column(nullable = false)
    private String tokenHash;
    private String deviceName;
    private String ipAddress;
    private Boolean isRevoked = false;
    private String revokedReason;
    private Instant revokedAt;
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant lastUsedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
