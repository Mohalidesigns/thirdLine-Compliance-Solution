package com.atheris.compliance.tenant.backend.modules.runbooks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

/** An active user who can own, operate or review a runbook (visible to every runbook role). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssigneeDto {
    private Integer userId;
    private String fullName;
    private String email;
    private String role;
}
