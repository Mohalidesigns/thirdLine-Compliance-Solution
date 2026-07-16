package com.atheris.compliance.tenant.backend.modules.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "audit_events")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long eventId;
    private Integer actorUserId;
    @Column(nullable = false)
    private String action;
    private String subjectType;
    private Long subjectId;
    @Column(columnDefinition = "text")
    private String beforeJson;
    @Column(columnDefinition = "text")
    private String afterJson;
    private String evidenceUrl;
    private Long previousEventId;
    @Column(nullable = false)
    private String previousEventHash;
    @Column(nullable = false)
    private String thisEventHash;
    @Column(nullable = false)
    private Instant occurredAt;

    @PrePersist
    void onCreate() {
        occurredAt = occurredAt != null ? occurredAt : Instant.now();
    }
}
