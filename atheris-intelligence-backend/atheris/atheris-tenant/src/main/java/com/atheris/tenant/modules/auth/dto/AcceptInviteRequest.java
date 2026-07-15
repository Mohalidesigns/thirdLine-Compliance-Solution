package com.atheris.tenant.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AcceptInviteRequest {
    @NotBlank private String token;
    @NotBlank private String password;
    @NotBlank private String confirmPassword;
    private String deviceName;
    private String ipAddress;
}
