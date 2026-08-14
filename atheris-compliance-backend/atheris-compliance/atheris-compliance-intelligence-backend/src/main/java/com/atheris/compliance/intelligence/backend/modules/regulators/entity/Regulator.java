package com.atheris.compliance.intelligence.backend.modules.regulators.entity;

import com.atheris.compliance.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;

@Entity @Table(name = "regulators")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Regulator {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer regulatorId;
    @Column(nullable = false) private String name;
    @Column(nullable = false, unique = true, length = 20) private String abbreviation;
    @Builder.Default
    private String country = "Nigeria";
    private String websiteUrl;
    @Builder.Default
    private Boolean scraperEnabled = true;
    private String publicationPageUrl;
    private String scraperFrequency;      // daily | hourly | weekly | 15min
    private String scraperStrategy;       // html | headless | disabled
    private String pdfLinkSelector;
    @Builder.Default
    private Boolean paginationEnabled = false;
    private String paginationSelector;
    private String paginationStrategy;   // NEXT_BUTTON | PAGE_PARAM | YEAR_FOLDERS
    @Builder.Default
    private Integer maxPagesPerRun = 3;
    @Builder.Default
    private Integer maxPdfSizeMb = 100;
    @Builder.Default
    private Integer historicalStartYear = 2022;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private Map<String, String> requestHeaders;
    private Instant scraperLastRanAt;
    @Builder.Default
    private Integer scraperLastFound = 0;
    private String logoUrl;
    private String description;
    private String scraperNotes;
    @Builder.Default
    private Boolean isActive = true;
    private Integer createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
