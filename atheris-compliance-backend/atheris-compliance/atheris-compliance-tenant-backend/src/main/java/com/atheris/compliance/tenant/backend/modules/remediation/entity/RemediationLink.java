package com.atheris.compliance.tenant.backend.modules.remediation.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A secure, account-less link for an owner to submit a finding's remediation.
 * Only the SHA-256 hash of the token is stored.
 */
@Entity
@Table(name = "remediation_links")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RemediationLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long linkId;
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(nullable = false)
    private Long findingId;
    private Integer ownerId;
    private String ownerEmail;
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant lastUsedAt;
    @Builder.Default
    private Integer useCount = 0;
    private Integer createdByUserId;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}