package com.atheris.compliance.tenant.backend.modules.reports.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * A generated board pack. Created as a DRAFT (watermarked PDF); a CCO signs it off,
 * which re-renders the PDF without the watermark and freezes the record.
 */
@Entity
@Table(name = "board_packs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardPack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long boardPackId;

    private Long tenantId;

    @Column(nullable = false)
    private LocalDate periodFrom;
    @Column(nullable = false)
    private LocalDate periodTo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> sections = List.of();

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "DRAFT";

    private Double complianceScore;

    @Column(columnDefinition = "text")
    private String filePath;
    private String fileName;
    @Column(length = 64)
    private String fileSha256;

    private Integer generatedByUserId;
    private String generatedByName;
    @Builder.Default
    private Instant generatedAt = Instant.now();

    private Integer signedOffByUserId;
    private String signedOffByName;
    private Instant signedOffAt;
    @Column(columnDefinition = "text")
    private String signOffNote;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
        if (generatedAt == null) generatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}