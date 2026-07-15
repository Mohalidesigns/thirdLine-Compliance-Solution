package com.atheris.tenant.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank private String email;
    @NotBlank private String password;
    private String deviceName;
    private String ipAddress;
}
