package com.atheris.tenant.modules.users.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data
@Builder
public class UserDto {
    private Integer userId;
    private String email;
    private String fullName;
    private String jobTitle;
    private String department;
    private String role;
    private Boolean isActive;
    private String inviteStatus;
    private Instant lastLoginAt;
    private Instant invitedAt;
}
