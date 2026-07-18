package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PollingConfigResponse {
    private Integer intervalMinutes;
    private Instant lastPolledAt;
}
