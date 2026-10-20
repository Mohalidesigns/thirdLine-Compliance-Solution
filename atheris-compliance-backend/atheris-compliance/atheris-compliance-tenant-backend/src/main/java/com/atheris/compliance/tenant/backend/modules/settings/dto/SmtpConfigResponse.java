package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SmtpConfigResponse {
    private String host;
    private Integer port;
    private String username;
    private String from;
    private Boolean auth;
    private Boolean starttls;
    private Boolean passwordSet;
}
