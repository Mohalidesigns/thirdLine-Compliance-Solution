package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_execution_signoffs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookExecutionSignoff {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long signoffId;
    @Column(nullable = false)
    private Long executionId;
    @Column(nullable = false)
    private String signoffRole;
    @Column(nullable = false)
    private Integer userId;
    @Column(nullable = false)
    private String decision;
    @Column(columnDefinition = "text")
    private String comment;
    private Instant signedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (signedAt == null) signedAt = now;
    }
}
