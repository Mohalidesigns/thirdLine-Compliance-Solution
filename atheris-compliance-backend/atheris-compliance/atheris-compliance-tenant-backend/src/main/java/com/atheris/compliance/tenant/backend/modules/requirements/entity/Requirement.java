package com.atheris.compliance.tenant.backend.modules.requirements.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "requirements")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Requirement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requirementId;

    @Column(nullable = false)
    private Long obligationId;

    @Column(nullable = false)
    private Integer ordinal;

    @Column(nullable = false, columnDefinition = "text")
    private String text;

    private Integer riskId;
    private String stateOverride;

    @Column(columnDefinition = "text")
    private String overrideReason;

    @Builder.Default private String source = "toolkit_seed";
    @Builder.Default private Instant createdAt = Instant.now();
    @Builder.Default private Instant updatedAt = Instant.now();

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
