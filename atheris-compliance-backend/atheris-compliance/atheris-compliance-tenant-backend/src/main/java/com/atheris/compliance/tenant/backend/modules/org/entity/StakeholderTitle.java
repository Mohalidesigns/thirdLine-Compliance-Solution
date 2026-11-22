package com.atheris.compliance.tenant.backend.modules.org.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "stakeholder_titles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StakeholderTitle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "title_id")
    private Integer titleId;

    @Column(nullable = false)
    private String name;

    private Integer defaultDepartmentId;
    private Integer defaultUnitId;

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Integer sortOrder = 0;

    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
