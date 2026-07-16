package com.atheris.compliance.intelligence.backend.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class ClassifyResponse {
    private Long instrumentId;
    private Long tenantId;
    private String applicability;          // What was decided
    private Instant classifiedAt;
    private Boolean watchCreated;          // true = tenant will now receive change notifications
    private String message;
    // e.g. "Obligation classified. You will be notified of any updates."
    private String nextStep;
    // e.g. "Open in compliance workspace to assign owner and link controls."
    // null if applicability = not_applicable
}
