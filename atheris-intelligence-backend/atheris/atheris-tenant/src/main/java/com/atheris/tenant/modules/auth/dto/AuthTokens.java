package com.atheris.tenant.modules.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthTokens {
    private String accessToken;
    private String refreshToken;
    private Integer accessTokenExpiresIn;
    private String tokenType;
    private UserSummary user;

    @Data
    @Builder
    public static class UserSummary {
        private Integer userId;
        private String email;
        private String fullName;
        private String role;
    }
}
