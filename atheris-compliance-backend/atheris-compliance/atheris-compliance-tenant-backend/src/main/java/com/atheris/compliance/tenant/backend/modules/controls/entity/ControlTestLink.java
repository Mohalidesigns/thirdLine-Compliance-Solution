package com.atheris.compliance.tenant.backend.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "control_test_links")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControlTestLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long linkId;
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(nullable = false)
    private Integer controlId;
    private Long taskId;
    private String recipientEmail;
    private String recipientName;
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
