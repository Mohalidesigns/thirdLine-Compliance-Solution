package com.atheris.compliance.tenant.backend.modules.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "invite_tokens")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer tokenId;
    @Column(nullable = false)
    private Integer userId;
    private String token;
    @Column(nullable = false)
    private String tokenHash;
    @Column(nullable = false)
    private String tokenType;
    private Boolean isUsed = false;
    private Instant usedAt;
    @Column(nullable = false)
    private Instant expiresAt;
    private Integer createdByUserId;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
