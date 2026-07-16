package com.atheris.compliance.intelligence.backend.modules.notifications.entity;

import com.atheris.compliance.common.Constants;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;

@Entity @Table(name = "obligation_changes")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObligationChange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long changeId;
    @Column(nullable = false) private Long instrumentId;
    @Column(nullable = false) private String changeType;
    // classification_updated | obligation_added | sanction_updated
    // superseded | applicability_clarified | status_changed
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> changedFields;  // the diff
    @Column(columnDefinition = "text", nullable = false)
    private String changeSummary;
    private String changeSeverity = "medium";   // low | medium | high
    private String changedBy;
    // ai_reclassification | platform_admin | scraper
    private Long supersededByInstrumentId;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
