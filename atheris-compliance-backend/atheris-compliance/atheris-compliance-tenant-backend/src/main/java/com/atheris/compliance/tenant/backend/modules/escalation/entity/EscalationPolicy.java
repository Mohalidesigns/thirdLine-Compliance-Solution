package com.atheris.compliance.tenant.backend.modules.escalation.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "escalation_policies")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EscalationPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long policyId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 20)
    private String subjectType;

    @Builder.Default
    private Boolean isDefault = false;

    @Builder.Default
    private Boolean isActive = true;

    private Integer reminderStartValue;
    @Column(length = 10)
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    @Column(length = 10)
    private String reminderRepeatUnit;

    @Builder.Default
    private Boolean sendLink = true;

    @Builder.Default
    private Boolean notifyOnStart = false;

    @Column(length = 20)
    private String frequencyScope;

    private Integer createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
