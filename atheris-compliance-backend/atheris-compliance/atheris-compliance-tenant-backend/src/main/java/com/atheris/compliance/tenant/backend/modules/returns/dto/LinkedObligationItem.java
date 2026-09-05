package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class LinkedObligationItem {
    private Long obligationId;
    private String title;
    private String name;
    private String plainEnglishStatement;
    private String sectionReference;
    private String areaOfFocus;
    private String inherentRiskRating;
    private String actName;
    private String obligationType;
    private String recurringDeadlineType;
}
