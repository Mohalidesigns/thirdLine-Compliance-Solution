package com.atheris.compliance.tenant.backend.modules.notifications.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationTemplateRequest {
    private String subject;
    private String body;
    private Boolean ccOwner;
    private Boolean isActive;
}
