package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "obligation_controls")
@IdClass(ObligationControlId.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationControl {

    @Id
    @Column(name = "obligation_id")
    private Long obligationId;

    @Id
    @Column(name = "compliance_control_id")
    private Long complianceControlId;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }
}
