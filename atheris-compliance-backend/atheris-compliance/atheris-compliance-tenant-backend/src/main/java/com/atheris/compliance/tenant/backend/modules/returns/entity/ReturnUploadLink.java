package com.atheris.compliance.tenant.backend.modules.returns.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A secure, account-less link that lets a return's owner record an event filing (with evidence)
 * for an event-driven return. Only the SHA-256 hash of the token is stored.
 */
@Entity
@Table(name = "return_upload_links")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnUploadLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long linkId;
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(nullable = false)
    private Long returnId;
    private String recipientEmail;
    private String recipientName;
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
