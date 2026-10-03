package com.atheris.compliance.tenant.backend.modules.imports.dto;

import lombok.*;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportBatchSummary {
    private Long batchId;
    private String entityType;
    private String fileName;
    private String status;
    private int totalRows;
    private int validRows;
    private int invalidRows;
    private int duplicateRows;
    private int importedRows;
    private Instant createdAt;
    private Instant committedAt;
    private String createdByName;
}
