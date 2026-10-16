package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "runbook_executions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookExecution {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long executionId;
    @Column(nullable = false)
    private String executionRef;
    @Column(nullable = false)
    private Long runbookId;
    @Column(nullable = false)
    private Long versionId;
    @Column(nullable = false)
    private String triggerType;
    private Long triggerRefId;
    private Long scheduleId;
    private LocalDate scheduledFor;
    @Column(nullable = false)
    private Integer operatorUserId;
    @Column(columnDefinition = "text")
    private String operatorName;
    @Builder.Default
    private String status = "NOT_STARTED";
    private String outcome;
    private String statusBeforePause;
    private Instant startedAt;
    private Instant dueAt;
    private Instant preflightCompletedAt;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Long> preflightAcks = new ArrayList<>();
    private Instant completedAt;
    private Instant closedAt;
    @Column(columnDefinition = "text")
    private String outcomeSummary;
    @Builder.Default
    private Integer stepsTotal = 0;
    @Builder.Default
    private Integer stepsPassed = 0;
    @Builder.Default
    private Integer stepsFailed = 0;
    @Builder.Default
    private Integer stepsSkipped = 0;
    @Builder.Default
    private Integer evidenceCount = 0;
    private Long findingId;
    private Long packFileId;
    private String packHash;
    private Instant packGeneratedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
