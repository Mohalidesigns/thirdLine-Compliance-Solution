package com.atheris.compliance.tenant.backend.modules.notifications.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationTemplateDto {
    private Long templateId;
    private String templateKey;
    private String channel;
    private String subject;
    private String body;
    private Boolean ccOwner;
    private Boolean isActive;
    private Instant updatedAt;
}
