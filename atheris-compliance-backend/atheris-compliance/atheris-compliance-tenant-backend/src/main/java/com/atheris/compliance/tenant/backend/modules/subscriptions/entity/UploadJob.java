package com.atheris.compliance.tenant.backend.modules.subscriptions.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "upload_jobs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UploadJob {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true) private UUID uploadId;
    @Column(nullable = false) private Long tenantId;
    @Column(nullable = false) private Long tenantRegulatorId;
    private Long platformInstrumentId;
    private Long platformJobId;
    private String status = "queued";
    @Column(columnDefinition = "text") private String errorMessage;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
