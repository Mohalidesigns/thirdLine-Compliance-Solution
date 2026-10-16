package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RunbookTemplateSeedResult {
    @Builder.Default private int read = 0;
    @Builder.Default private int inserted = 0;
    @Builder.Default private int updated = 0;
    @Builder.Default private int unchanged = 0;
    @Builder.Default private int skipped = 0;
}
