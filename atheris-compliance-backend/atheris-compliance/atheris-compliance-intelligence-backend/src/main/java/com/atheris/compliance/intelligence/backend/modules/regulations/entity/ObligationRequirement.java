package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "obligation_requirements")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationRequirement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requirementId;

    @Column(nullable = false)
    private Long obligationId;

    @Column(nullable = false)
    private Integer ordinal;

    @Column(nullable = false, columnDefinition = "text")
    private String text;

    private Integer riskId;

    @Builder.Default private String source = "toolkit_seed";
    @Builder.Default private Instant createdAt = Instant.now();
}