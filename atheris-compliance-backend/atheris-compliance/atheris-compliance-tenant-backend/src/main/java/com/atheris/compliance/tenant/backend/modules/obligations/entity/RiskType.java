package com.atheris.compliance.tenant.backend.modules.obligations.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "risk_types")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class RiskType {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer riskTypeId;
    @Column(nullable = false, unique = true) private String name;
    @Column(columnDefinition = "text") private String description;
    private Integer displayOrder;
}
