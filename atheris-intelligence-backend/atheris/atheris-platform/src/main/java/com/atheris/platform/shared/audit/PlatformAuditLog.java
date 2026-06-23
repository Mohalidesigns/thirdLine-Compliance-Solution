package com.atheris.platform.shared.audit;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "platform_audit_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformAuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long logId;
    private Integer actorId;
    private String actorType;           // user | system
    private String action;              // regulator_created | instrument_uploaded | tenant_onboarded etc.
    private String subjectType;         // regulator | instrument | tenant | webhook
    private Long subjectId;
    @Column(columnDefinition = "jsonb") private String metadataJson;
    private Instant occurredAt;
    private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
