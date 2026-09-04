package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "obligation_sanctions", indexes = {
    @Index(name = "idx_obligation_sanctions_obligation", columnList = "obligationId"),
    @Index(name = "idx_obligation_sanctions_sanction", columnList = "sanctionId")
})
@IdClass(ObligationSanctionId.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationSanction {

    @Id
    @Column(name = "obligation_id")
    private Long obligationId;

    @Id
    @Column(name = "sanction_id")
    private Long sanctionId;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
