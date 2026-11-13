package com.atheris.compliance.tenant.backend.modules.evidence.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class EvidenceRegisterItem {
    private Long fileId;
    private String originalName;
    private String mimeType;
    private Long fileSize;
    private String category;
    private String sourceType;
    private Long sourceId;
    private String description;
    private String uploadedByName;
    private Instant createdAt;
    private String linkedLabel;
    private String linkedPath;
}