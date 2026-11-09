package com.atheris.compliance.tenant.backend.modules.risks.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "risk_obligations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@IdClass(RiskObligation.Key.class)
public class RiskObligation {
    @Id private Integer riskId;
    @Id private Long obligationId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Integer riskId;
        private Long obligationId;
    }
}
