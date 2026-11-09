package com.atheris.compliance.intelligence.backend.modules.regulations.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;

@Entity
@Table(name = "risk_controls")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
@IdClass(RiskControl.Key.class)
public class RiskControl {
    @Id private Integer riskId;
    @Id @Column(name = "control_id") private Integer controlId;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Key implements Serializable {
        private Integer riskId;
        private Integer controlId;
    }
}