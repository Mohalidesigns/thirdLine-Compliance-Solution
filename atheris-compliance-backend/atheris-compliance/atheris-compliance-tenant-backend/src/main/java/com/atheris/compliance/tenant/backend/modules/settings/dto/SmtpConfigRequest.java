package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.Data;

@Data
public class SmtpConfigRequest {
    private String host;
    private Integer port;
    private String username;
    private String password;
    private Boolean auth;
    private Boolean starttls;
    private String from;
    private String testTo;
}
