package com.atheris.compliance.intelligence.backend.modules.licenses.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.Instant;

@Data
public class RenewLicenseRequest {
    @NotNull
    private Instant expiresAt;
    private Integer gracePeriodDays;
}
