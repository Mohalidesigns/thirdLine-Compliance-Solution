package com.atheris.compliance.intelligence.backend.modules.jobs.entity;

import com.atheris.compliance.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;

@Entity @Table(name = "job_queue")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class JobQueue {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long jobId;
    @Column(nullable = false) private String jobType;
    // ocr_document | classify_instrument | evaluate_applicability
    // send_webhooks | retry_webhook | deliver_change_notification
    private String subjectType;
    private Long subjectId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> payload;
    private String status = Constants.STATUS_PENDING;  // pending | processing | completed | failed
    private Integer priority = 0;       // 1=HIGH (monitoring), 0=LOW (backfill)
    private Integer attemptCount = 0;
    private Integer maxAttempts = 3;
    private String lastError;
    private Instant nextRetryAt;
    private Instant startedAt;
    private Instant completedAt;
    private String createdByService;
    private Instant createdAt;
    private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
