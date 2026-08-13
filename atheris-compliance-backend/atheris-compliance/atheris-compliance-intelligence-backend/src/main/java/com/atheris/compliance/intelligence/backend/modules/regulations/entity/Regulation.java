package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "regulations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Regulation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long regulationId;
    @Column(nullable = false, unique = true, length = 500) private String name;
    private String abbreviation;
    @Column(columnDefinition = "text") private String description;
    private Integer regulatorId;
    private Long canonicalInstrumentId;
    private String status = "Active";
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}