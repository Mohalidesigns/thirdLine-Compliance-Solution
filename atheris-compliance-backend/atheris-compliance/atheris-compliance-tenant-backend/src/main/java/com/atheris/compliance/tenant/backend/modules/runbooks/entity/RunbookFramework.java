package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "runbook_frameworks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookFramework {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer frameworkId;
    @Column(nullable = false)
    private String code;
    @Column(nullable = false, columnDefinition = "text")
    private String name;
    private String issuer;
    @Builder.Default
    private String jurisdiction = "NG";
    private String versionLabel;
    @Column(columnDefinition = "text")
    private String sourceUrl;
    @Builder.Default
    private Boolean isInternal = false;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
