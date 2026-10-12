package com.atheris.compliance.tenant.backend.modules.acts.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "acts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Act {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "act_id")
    private Integer actId;

    @Column(name = "regulation_id", nullable = false, unique = true)
    private Long regulationId;

    @Column(name = "canonical_instrument_id")
    private Long canonicalInstrumentId;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    private String abbreviation;

    @Column(name = "regulator_id")
    private Integer regulatorId;

    @Column(name = "regulator_name", columnDefinition = "text")
    private String regulatorName;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
