package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_evidence_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookEvidenceItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long evidenceId;
    @Column(nullable = false)
    private Long stepExecId;
    private Long reqId;
    @Column(nullable = false)
    private String evidenceType;
    private Long fileId;
    @Column(columnDefinition = "text")
    private String externalRef;
    @Column(columnDefinition = "text")
    private String attestationText;
    private String sha256;
    private Integer retentionYears;
    @Column(nullable = false)
    private Integer capturedByUserId;
    private Instant capturedAt;
    @Builder.Default
    private Boolean isImmutable = true;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (capturedAt == null) capturedAt = now;
    }
}
