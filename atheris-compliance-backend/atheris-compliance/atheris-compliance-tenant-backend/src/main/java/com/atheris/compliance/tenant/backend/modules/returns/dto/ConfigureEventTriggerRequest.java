package com.atheris.compliance.tenant.backend.modules.returns.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConfigureEventTriggerRequest {
    @NotBlank @Size(max = 255) private String triggerLabel;
    @NotBlank private String deadlineMode;
    @Min(1) @Max(365) private Integer deadlineDays;
    private String deadlineUnit;
}
