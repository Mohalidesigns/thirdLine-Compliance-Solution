package com.atheris.platform.modules.regulators.entity;

import com.atheris.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "scraper_run_logs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScraperRunLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long logId;
    @Column(nullable = false) private Integer regulatorId;
    private String mode;               // monitoring | backfill
    @Column(nullable = false) private Instant runAt;
    private Integer documentsFound = 0;
    private Integer newDocuments = 0;
    private Integer skippedDocuments = 0;
    private Integer failedDocuments = 0;
    private String status;             // success | partial_failure | failed
    @Column(columnDefinition = "text") private String errorMessage;
    private Integer durationMs;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
