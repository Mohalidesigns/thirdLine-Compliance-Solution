package com.atheris.compliance.tenant.backend.modules.cors.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "cors_whitelist")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CorsWhitelist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String origin;

    @Column(length = 255)
    private String description;

    @Builder.Default
    private Boolean isActive = true;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
