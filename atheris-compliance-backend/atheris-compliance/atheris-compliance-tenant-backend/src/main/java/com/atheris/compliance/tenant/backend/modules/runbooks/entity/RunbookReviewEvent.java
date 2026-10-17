package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_review_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookReviewEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long reviewId;
    @Column(nullable = false)
    private Long runbookId;
    @Column(nullable = false)
    private String triggerType;
    @Column(columnDefinition = "text")
    private String triggerRef;
    @Builder.Default
    private String status = "OPEN";
    private Instant openedAt;
    private Integer reviewerUserId;
    @Column(columnDefinition = "text")
    private String outcomeNotes;
    private Long resultingVersionId;
    private Instant closedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (openedAt == null) openedAt = now;
    }
}
