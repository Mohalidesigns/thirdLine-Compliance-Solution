package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class AdminControlDto {
    private Long complianceControlId;
    private String controlNumber;
    private String theme;
    private String complianceArea;
    private String riskLevel;
    private String frequency;
    private String responsibleOfficer;
    private String dueDate;
    private String status;
    private Long actId;
    private String actName;
    private String controlSummary;
    /** First cleaned control point (null when the control has no baked points). */
    private String firstPoint;
    /** Number of cleaned control points; 0 when none. */
    private Integer pointCount;
}
