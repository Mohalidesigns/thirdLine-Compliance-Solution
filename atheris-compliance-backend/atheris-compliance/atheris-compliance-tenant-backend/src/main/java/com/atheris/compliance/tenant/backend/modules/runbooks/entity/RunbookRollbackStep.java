package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runbook_rollback_steps")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookRollbackStep {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long rollbackId;
    @Column(nullable = false)
    private Long versionId;
    @Column(nullable = false)
    private Integer sortOrder;
    private Long reversesStepId;
    private String reversesStepCode;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(nullable = false, columnDefinition = "text")
    private String instructionMd;
    @Column(columnDefinition = "text")
    private String commandBlock;
    @Column(columnDefinition = "text")
    private String verification;
}
