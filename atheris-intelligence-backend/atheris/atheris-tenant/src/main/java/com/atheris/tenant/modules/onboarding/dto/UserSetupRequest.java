package com.atheris.tenant.modules.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.Map;

@Data
public class UserSetupRequest {
    @NotBlank
    private String authType;
    private LocalAdminUser localAdmin;
    private Map<String, Object> ldapConfig;

    @Data
    public static class LocalAdminUser {
        @NotBlank
        private String fullName;
        @NotBlank
        private String email;
        @NotBlank
        private String password;
    }
}
