package com.atheris.compliance.tenant.backend.modules.onboarding.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "regulator_recommendations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatorRecommendation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(nullable = false, length = 100)
    private String licenceType;
    @Column(nullable = false)
    private Integer regulatorId;
    private Integer sortOrder;
}
