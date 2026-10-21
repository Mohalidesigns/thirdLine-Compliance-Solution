package com.atheris.compliance.tenant.backend.modules.escalation.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "escalation_events")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long eventId;

    @Column(nullable = false, length = 20)
    private String subjectType;

    @Column(nullable = false)
    private Long subjectId;

    @Column(length = 500)
    private String subjectLabel;

    @Column(nullable = false, length = 20)
    private String triggerType;

    @Builder.Default
    private Integer level = 0;

    @Column(length = 25)
    private String targetType;
    private Integer targetUserId;
    @Column(length = 30)
    private String targetRole;
    private String targetName;
    private String targetEmail;

    @Column(columnDefinition = "text")
    private String cc;

    @Column(length = 20)
    private String channel;

    @Column(length = 100)
    private String templateKey;

    private Instant firedAt;
    private Instant acknowledgedAt;

    @PrePersist
    void onCreate() { if (firedAt == null) firedAt = Instant.now(); }
}
