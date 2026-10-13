package com.atheris.compliance.tenant.backend.modules.reports.dto;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardPackPreviewDto {
    private String institutionName;
    private String licenceType;
    private LocalDate periodFrom;
    private LocalDate periodTo;
    @Builder.Default private List<String> sections = List.of();
    private ComplianceMetricsDto metrics;
    private Double previousScore;
}