package com.atheris.compliance.tenant.backend.modules.imports.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportPreviewResponse {
    private Long batchId;
    private String entityType;
    private String fileName;
    private String status;
    private int totalRows;
    private int validRows;
    private int invalidRows;
    private int duplicateRows;
    private List<ImportRowResult> rows;
}
