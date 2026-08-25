package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "act_aliases")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulationAlias {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long aliasId;
    @Column(nullable = false, unique = true, length = 500) private String alias;
    @Column(name = "act_id", nullable = false) private Long regulationId;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}