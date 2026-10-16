package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/** A platform-authored runbook template; {@code content} is the portable runbook JSON. */
@Entity @Table(name = "runbook_templates")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookTemplate {

    public static final String STATUS_PUBLISHED = "PUBLISHED";
    public static final String STATUS_DRAFT = "DRAFT";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long templateId;

    @Column(nullable = false, unique = true, length = 50)
    private String templateCode;

    @Builder.Default
    @Column(nullable = false)
    private Integer templateVersion = 1;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(nullable = false, length = 20)
    private String criticality;

    @Column(length = 30)
    private String frequency;

    private Integer slaMinutes;

    @Column(columnDefinition = "TEXT")
    private String objective;

    @Builder.Default
    @Column(nullable = false)
    private Integer stepCount = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer sectionCount = 0;

    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> content;

    @Column(nullable = false, length = 64)
    private String contentHash;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String status = STATUS_PUBLISHED;

    private Instant publishedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (publishedAt == null && STATUS_PUBLISHED.equals(status)) publishedAt = now;
    }

    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
