package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.*;

/** Sanitised return view shown on the public (no-login) event-filing upload page. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicReturnUploadView {
    private Long returnId;
    private String institutionName;

    // Return identity
    private String returnName;
    private String regulator;
    private String actName;
    private String frequency;
    private String frequencyType;

    // Event trigger context
    private String triggerLabel;
    private String deadlineMode;
    private Integer deadlineDays;
    private String deadlineUnit;
    private String deadlineText;

    // Responsibility
    private String responsibleUnit;
    private String responsiblePerson;
    private String ownerName;

    /** False when the return is inactive or its event trigger is not configured. */
    private boolean editable;
}
