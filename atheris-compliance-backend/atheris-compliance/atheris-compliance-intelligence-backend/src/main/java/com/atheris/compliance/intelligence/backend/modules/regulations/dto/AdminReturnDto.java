package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data @Builder
public class AdminReturnDto {
    private Long returnId;
    private String title;
    private String sectionReference;
    private String frequency;
    private String frequencyType;
    private String deadline;
    private String responsibleUnit;
    private String responsiblePerson;
    private Long actId;
    private String actName;
    private Long instrumentId;
    private LocalDate filingDate;
}
