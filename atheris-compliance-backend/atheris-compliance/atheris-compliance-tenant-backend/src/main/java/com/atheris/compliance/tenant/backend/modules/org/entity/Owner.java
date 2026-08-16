package com.atheris.compliance.tenant.backend.modules.org.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "owners")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Owner {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer ownerId;
    @Column(nullable = false)
    private String fullName;
    private String email;
    private String jobTitle;
    private Integer teamId;
    private Integer departmentId;
    private Integer userId;
    @Builder.Default
    private Boolean isActive = true;
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
