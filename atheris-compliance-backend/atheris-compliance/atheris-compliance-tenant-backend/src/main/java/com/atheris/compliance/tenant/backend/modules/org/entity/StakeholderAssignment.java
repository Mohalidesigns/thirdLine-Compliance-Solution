package com.atheris.compliance.tenant.backend.modules.org.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "stakeholder_assignments")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StakeholderAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assignmentId;
    @Column(nullable = false)
    private String subjectType;
    @Column(nullable = false)
    private Long subjectId;
    @Column(nullable = false)
    private Integer stakeholderId;
    @Column(nullable = false)
    private Integer roleId;
    private Integer createdByUserId;
    @Builder.Default
    private Boolean isActive = true;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
