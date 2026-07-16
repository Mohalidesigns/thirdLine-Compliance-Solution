package com.atheris.platform.modules.browser.dto;

import lombok.Data;

@Data
public class ObligationSearchRequest {
    private String q;                   // Full-text search query
    private Integer regulatorId;        // Filter by regulator
    private String riskRating;          // High | Medium | Low
    private String areaOfFocus;         // e.g. "AML/CFT"
    private String instrumentType;      // Circular | Act | Guideline etc.
    private String status;              // Published | Triage | Superseded
    private String applicableTo;        // Licence type filter
    private String since;               // ISO date — obligations published after this date
    private Long tenantId;            // Set from JWT — used to show classification status
}
