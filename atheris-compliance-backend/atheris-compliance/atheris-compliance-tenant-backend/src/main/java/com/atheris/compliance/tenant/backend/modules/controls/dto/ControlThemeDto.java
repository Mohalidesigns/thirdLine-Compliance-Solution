package com.atheris.compliance.tenant.backend.modules.controls.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ControlThemeDto {
    private Integer themeId;
    private String name;
    private String description;
    private Boolean isActive;
    @Builder.Default
    private Long usedBy = 0L;
}
