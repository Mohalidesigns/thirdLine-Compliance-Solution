package com.atheris.compliance.intelligence.backend.modules.browser.dto;

import com.atheris.compliance.common.Constants;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ClassifyRequest {

    @NotBlank
    @Pattern(regexp = Constants.CLASS_APPLICABLE + "|" + Constants.CLASS_NOT_APPLICABLE + "|" + Constants.CLASS_UNDER_REVIEW,
             message = "Must be: applicable, not_applicable, or under_review")
    private String applicability;

    private String applicabilityReasoning;
    // e.g. "GTB operates ATMs in 500+ locations. This is directly relevant."
    // Optional but recommended for audit trail.

    private String changeReason;
    // Only required when updating an existing classification.
    // e.g. "Reviewed after platform notification — risk rating increased to High."
}
