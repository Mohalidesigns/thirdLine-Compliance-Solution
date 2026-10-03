package com.atheris.compliance.tenant.backend.modules.imports.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.util.ArrayList;
import java.util.List;

/**
 * One spreadsheet data row as stored in {@code import_batches.rows}: the raw cell values in
 * template column order, the validation result and the display summary used by the preview.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ImportRowData {
    public static final String VALID = "valid";
    public static final String INVALID = "invalid";
    public static final String DUPLICATE = "duplicate";

    /** Excel row number (header is row 1, first data row is 2). */
    private Integer rowNumber;
    /** Raw trimmed cell values, one per template column, in template order (null when blank). */
    @Builder.Default private List<String> values = new ArrayList<>();
    @Builder.Default private String result = VALID;
    @Builder.Default private List<String> errors = new ArrayList<>();
    private String primary;
    private String secondary;
    private String context;
    private String risk;
    /** Id of the record created from this row at commit, null until then. */
    private Long createdId;

    public String value(int index) {
        return values != null && index < values.size() ? values.get(index) : null;
    }
}
