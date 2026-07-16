package com.atheris.tenant.modules.license.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class LicenseAuditEntryDto {
    private Integer id;
    private String eventType;
    private String status;
    private String deviceFingerprint;
    private String ipAddress;
    private Instant createdAt;
}
