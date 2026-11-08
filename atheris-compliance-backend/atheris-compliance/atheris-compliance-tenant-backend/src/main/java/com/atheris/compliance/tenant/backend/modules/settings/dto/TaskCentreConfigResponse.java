package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TaskCentreConfigResponse {
    private Integer controlDueHorizonDays;
}
