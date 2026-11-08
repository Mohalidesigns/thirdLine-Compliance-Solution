package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicControlTestView {
    private Integer controlId;
    private String institutionName;

    private String controlNumber;
    private String controlName;
    private String theme;
    private String controlType;
    private String whatItDoes;
    private String howTested;
    private String regulatoryRequirement;
    private String frequency;

    private String actName;
    private String regulator;
    private String responsiblePerson;
    private String ownerName;

    private LocalDate dueDate;
    private LocalDate lastTestDate;
    private String lastTestResult;

    private boolean editable;
}
