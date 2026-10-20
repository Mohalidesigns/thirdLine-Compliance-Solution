package com.atheris.compliance.tenant.backend.modules.ldap.controller;

import com.atheris.compliance.tenant.backend.modules.ldap.dto.LdapDirectoryResponse;
import com.atheris.compliance.tenant.backend.modules.ldap.dto.LdapDirectoryUser;
import com.atheris.compliance.tenant.backend.modules.ldap.service.LdapAuthService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ldap")
@RequiredArgsConstructor
public class LdapController {

    private final LdapAuthService ldap;

    /**
     * Directory search for the person picker. Returns {@code enabled:false} with an empty list
     * when the tenant is not configured for LDAP, so the client can fall back to inviting by email.
     */
    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('" + AppRole.TENANT_ADMIN + "','" + AppRole.CCO + "','" + AppRole.ANALYST + "')")
    public ResponseEntity<LdapDirectoryResponse> users(@RequestParam(required = false) String q) {
        boolean enabled = ldap.isLdapEnabled();
        List<LdapDirectoryUser> users = enabled
            ? ldap.searchUsers(q).stream()
                .map(u -> LdapDirectoryUser.builder().email(u.email()).fullName(u.fullName()).build())
                .toList()
            : List.of();
        return ResponseEntity.ok(LdapDirectoryResponse.builder().enabled(enabled).users(users).build());
    }
}
