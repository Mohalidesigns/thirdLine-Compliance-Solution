package com.atheris.compliance.tenant.backend.modules.escalation.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "escalation_instances")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalationInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long overrideId;

    @Column(nullable = false, length = 20)
    private String subjectType;

    @Column(nullable = false)
    private Long subjectId;

    private Long sourcePolicyId;

    private Integer reminderStartValue;
    @Column(length = 10)
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    @Column(length = 10)
    private String reminderRepeatUnit;

    @Builder.Default
    private Boolean sendLink = true;

    @Builder.Default
    private Boolean active = true;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
