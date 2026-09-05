package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;

@Data @Builder
public class AdminReturnDetailDto {
    private Long returnId;
    private String title;
    private String sectionReference;
    private String statutoryBasis;
    private String frequency;
    private String frequencyType;
    private String deadline;
    private String remarks;
    private String responsibleUnit;
    private String responsiblePerson;
    private Long actId;
    private String actName;
    private String actAbbreviation;
    private Long instrumentId;
    private LocalDate filingDate;
    private Instant createdAt;
}
