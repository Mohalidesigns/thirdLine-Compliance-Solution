package com.atheris.compliance.tenant.backend.modules.evidence.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "evidence_files")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvidenceFile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long fileId;
    @Column(nullable = false)
    private String fileName;
    @Column(nullable = false)
    private String originalName;
    private String mimeType;
    private Long fileSize;
    @Column(nullable = false)
    private String storagePath;
    private String sourceType;
    private Long sourceId;
    @Column(columnDefinition = "text")
    private String description;
    private Integer uploadedByUserId;
    private Instant createdAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }
}
