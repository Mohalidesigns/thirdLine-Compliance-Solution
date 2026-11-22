package com.atheris.compliance.tenant.backend.modules.org.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "stakeholder_roles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StakeholderRole {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer roleId;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    private String description;
    @Builder.Default
    private Boolean isDefault = false;
    @Builder.Default
    private Boolean isActive = true;
    @Builder.Default
    private Integer sortOrder = 0;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
