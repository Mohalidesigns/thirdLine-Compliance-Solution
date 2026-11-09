package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "risks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Risk {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer riskId;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String riskType;
    private String areaOfFocus;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentBand;

    @Builder.Default private String source = "toolkit_seed";
    @Builder.Default private Instant createdAt = Instant.now();
    @Builder.Default private Instant updatedAt = Instant.now();

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}