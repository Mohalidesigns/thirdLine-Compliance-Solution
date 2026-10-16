package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_execution_escalations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookExecutionEscalation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long execEscId;
    @Column(nullable = false)
    private Long executionId;
    @Column(nullable = false)
    private Integer level;
    @Column(nullable = false)
    private String triggerType;
    private Integer notifiedUserId;
    private String notifiedRole;
    private String channel;
    private Instant sentAt;
    private Instant acknowledgedAt;
    private Integer acknowledgedByUserId;
    @Column(columnDefinition = "text")
    private String notes;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (sentAt == null) sentAt = now;
    }
}
