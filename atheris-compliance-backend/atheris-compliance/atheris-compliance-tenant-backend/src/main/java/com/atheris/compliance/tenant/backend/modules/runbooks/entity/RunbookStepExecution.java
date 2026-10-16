package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_step_executions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookStepExecution {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long stepExecId;
    @Column(nullable = false)
    private Long executionId;
    private Long stepId;
    private Long rollbackId;
    @Column(nullable = false)
    private Integer sortOrder;
    @Builder.Default
    private String status = "PENDING";
    @Column(columnDefinition = "text")
    private String actualResult;
    @Column(columnDefinition = "text")
    private String operatorNotes;
    private String failureCategory;
    private Integer performedByUserId;
    private Integer verifiedByUserId;
    private Instant startedAt;
    private Instant completedAt;
    @Column(columnDefinition = "text")
    private String skipReason;
}
