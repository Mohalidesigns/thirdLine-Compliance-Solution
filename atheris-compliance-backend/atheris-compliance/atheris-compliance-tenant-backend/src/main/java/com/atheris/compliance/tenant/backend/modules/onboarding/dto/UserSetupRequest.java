package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class UserSetupRequest {
    @NotBlank
    private String authType;

    /** Local-auth only: the first tenant admin's credentials. */
    private LocalAdminUser localAdmin;

    /** LDAP only: connection settings. Stored (bind password encrypted) on the tenant profile. */
    private LdapConfigRequest ldapConfig;

    /**
     * The CCO and Analyst identities to provision. Both auth types create these rows so they
     * can sign in — LDAP authenticates them, local auth invites them. The Tenant Admin is the
     * row created from {@link #localAdmin} (local) or {@link #breakGlassAdmin} (LDAP).
     */
    private List<SeededUser> seedUsers;

    /**
     * LDAP only: a local tenant-admin row with a password, so the tenant can always sign in
     * even if the directory is down. Flagged in the UI as a break-glass account.
     */
    private LocalAdminUser breakGlassAdmin;

    @Data
    public static class LocalAdminUser {
        @NotBlank
        private String fullName;
        @NotBlank
        private String email;
        @NotBlank
        private String password;
    }

    @Data
    public static class SeededUser {
        @NotBlank
        private String role;
        @NotBlank
        private String fullName;
        @NotBlank
        private String email;
        /** Local-auth only; ignored for LDAP (the directory owns the password). */
        private String password;
    }

    @Data
    public static class LdapConfigRequest {
        @NotBlank
        private String url;
        @NotBlank
        private String bindDn;
        @NotBlank
        private String bindPassword;
        @NotBlank
        private String userSearchBase;
        private String userSearchFilterAttribute;
        private String fullNameAttribute;
    }
}