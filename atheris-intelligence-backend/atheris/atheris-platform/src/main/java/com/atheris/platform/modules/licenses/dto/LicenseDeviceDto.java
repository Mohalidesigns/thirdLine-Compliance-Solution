package com.atheris.platform.modules.licenses.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class LicenseDeviceDto {
    private Integer id;
    private String deviceFingerprint;
    private String deviceLabel;
    private Instant lastSeenAt;
    private String lastIpAddress;
    private Instant createdAt;
}
