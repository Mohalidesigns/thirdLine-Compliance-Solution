package com.atheris.platform.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data @Builder @AllArgsConstructor
public class LoginResponse {
    private String accessToken;
    private UserDto user;
}
