package com.atheris.compliance.intelligence.backend.modules.cors.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class CorsWhitelistDto {
    private Long id;
    private String origin;
    private String description;
    private Boolean isActive;
    private Instant createdAt;
}
