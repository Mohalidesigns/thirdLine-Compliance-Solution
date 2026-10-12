package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

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
    /** Cleaned control statements (the register shows the first; hover reveals the rest). */
    private List<String> controlPoints;
}
