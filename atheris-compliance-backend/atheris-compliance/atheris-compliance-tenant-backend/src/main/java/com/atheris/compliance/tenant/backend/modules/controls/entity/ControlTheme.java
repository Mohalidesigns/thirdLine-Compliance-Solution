package com.atheris.compliance.tenant.backend.modules.controls.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "control_themes")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ControlTheme {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer themeId;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Builder.Default
    private Boolean isActive = true;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
