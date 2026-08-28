package com.atheris.compliance.tenant.backend.modules.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "risk_matrix_config")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskMatrixConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long tenantId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> impactLevels = List.of("Low", "Medium", "High", "Very High");

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> likelihoodLevels = List.of("Very Low", "Low", "Medium", "High");

    @Builder.Default
    private String scoringFormula = "product";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Integer> bandThresholds = Map.of("moderate", 6, "high", 9, "critical", 9);
}
