package com.atheris.compliance.tenant.backend.modules.users.dto;

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
    private Integer managerUserId;
    private String managerName;
    private Boolean isActive;
    private String inviteStatus;
    /** LDAP tenants only: a local-admin escape hatch that signs in without the directory. */
    private Boolean isBreakGlass;
    private Instant lastLoginAt;
    private Instant invitedAt;
}
