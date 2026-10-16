package com.atheris.compliance.tenant.backend.modules.runbooks.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "runbooks")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Runbook {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long runbookId;
    @Column(nullable = false)
    private String runbookCode;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(nullable = false)
    private String category;
    @Column(columnDefinition = "text")
    private String objective;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> scopeSystems = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> scopeTeams = new ArrayList<>();
    private Integer ownerUserId;
    @Column(columnDefinition = "text")
    private String ownerName;
    @Builder.Default
    private String criticality = "MEDIUM";
    private String frequency;
    private Integer slaMinutes;
    @Builder.Default
    private String reviewCadence = "ANNUAL";
    @Builder.Default
    private String status = "DRAFT";
    @Column(columnDefinition = "text")
    private String statusReason;
    private Long currentVersionId;
    private Long sourceTemplateId;
    private String sourceTemplateCode;
    private Integer sourceTemplateVer;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Long> linkedObligationIds = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Long> linkedControlIds = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    private Integer createdByUserId;
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
