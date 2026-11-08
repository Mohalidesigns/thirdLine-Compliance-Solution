package com.atheris.compliance.tenant.backend.modules.controls.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ControlThemeRequest {
    private String name;
    private String description;
}
