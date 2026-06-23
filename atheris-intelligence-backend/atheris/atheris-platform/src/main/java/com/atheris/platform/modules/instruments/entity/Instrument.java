package com.atheris.platform.modules.instruments.entity;

import com.atheris.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Entity @Table(name = "instruments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Instrument {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long instrumentId;
    @Column(nullable = false) private Integer regulatorId;
    private Integer typeId;
    @Column(nullable = false, length = 500) private String sourceTitle;
    private String sourceReferenceNumber;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private LocalDate dateSuperseded;
    private String areaOfFocus;
    private Integer themeId;
    private String nature;              // Core | Secondary | Guidance
    private String riskRating;          // High | Medium | Low
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> licenceTypesApplicable;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")
    private List<String> productLinesApplicable;
    private Double applicabilityConfidence;
    private String applicabilityNotes;
    private String pdfUrl;
    @Column(columnDefinition = "text") private String pdfOcrText;
    private String pdfHash;
    private String sourceUrl;
    private String sourcePageUrl;
    private String sourcePageSnapshotUrl;
    private String sourcePageHash;
    private LocalDate publishedAt;
    private Instant discoveredAt;
    private Instant firstPublishedAt;
    private String status = Constants.INST_TRIAGE;   // Triage | Published | Superseded | Withdrawn
    private String uploadSource = "scraper"; // scraper | manual_upload | backfill
    private Integer uploadedBy;
    private Boolean isHistoricalBackfill = false;
    @Column(columnDefinition = "text") private String aiSummary;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); discoveredAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
