package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_version_approvals")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookVersionApproval {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long approvalId;
    @Column(nullable = false)
    private Long versionId;
    @Column(nullable = false)
    private Integer approverUserId;
    private String approverRole;
    @Column(nullable = false)
    private String decision;
    @Column(columnDefinition = "text")
    private String comment;
    private Instant decidedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (decidedAt == null) decidedAt = now;
    }
}
