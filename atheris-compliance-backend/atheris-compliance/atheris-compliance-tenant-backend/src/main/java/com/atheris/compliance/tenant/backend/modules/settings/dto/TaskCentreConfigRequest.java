package com.atheris.compliance.tenant.backend.modules.settings.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TaskCentreConfigRequest {
    @NotNull
    @Min(0)
    private Integer controlDueHorizonDays;
}
