package com.atheris.compliance.tenant.backend.modules.settings.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class PollingConfigRequest {
    @Min(1) @Max(1440)
    private Integer intervalMinutes;
}
