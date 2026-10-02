package com.atheris.compliance.tenant.backend.modules.imports.dto;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportRowResult {
    private Integer rowNumber;
    /** valid | invalid | duplicate */
    private String result;
    private List<String> errors;
    private String primary;
    private String secondary;
    private String context;
    private String risk;
}
