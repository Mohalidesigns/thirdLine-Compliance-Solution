package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_versions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long versionId;
    @Column(nullable = false)
    private Long runbookId;
    @Column(nullable = false)
    private Integer versionNumber;
    @Column(columnDefinition = "text")
    private String changeSummary;
    private String contentHash;
    @Builder.Default
    private String status = "DRAFT";
    private Integer authoredByUserId;
    private Instant submittedAt;
    private Integer approvedByUserId;
    private Instant approvedAt;
    private Instant publishedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
    }
}
