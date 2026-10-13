package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.*;

/** Per-tenant weights (percentages summing to 100) for the compliance score. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreWeightsDto {
    @Builder.Default private Integer controlCoverage = 30;
    @Builder.Default private Integer controlTests = 25;
    @Builder.Default private Integer returnsOnTime = 30;
    @Builder.Default private Integer findingsWithinSla = 15;
}