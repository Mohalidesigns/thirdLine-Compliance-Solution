package com.atheris.compliance.tenant.backend.modules.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InviteUserRequest {
    @Email @NotBlank private String email;
    @NotBlank private String fullName;
    private String jobTitle;
    private String department;
    @NotBlank private String role;
}
