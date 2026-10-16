package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_steps")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookStep {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long stepId;
    @Column(nullable = false)
    private Long sectionId;
    @Column(nullable = false)
    private Integer sortOrder;
    private String stepCode;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(nullable = false, columnDefinition = "text")
    private String instructionMd;
    @Column(columnDefinition = "text")
    private String commandBlock;
    private String commandLang;
    @Column(columnDefinition = "text")
    private String expectedResult;
    private Integer durationEstimateMin;
    private String assignedRole;
    @Builder.Default
    private Boolean isBlocking = true;
    @Builder.Default
    private Boolean requiresDualControl = false;
    @Builder.Default
    private Boolean allowSkip = false;
    @Column(columnDefinition = "text")
    private String safetyNote;
}
