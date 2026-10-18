package com.atheris.compliance.tenant.backend.modules.remediation.controller;

import com.atheris.compliance.tenant.backend.modules.remediation.service.RemediationLinkService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Analyst-facing remediation-link actions: create (and email) a link for a finding.
 */
@RestController
@RequestMapping("/api/v1/findings")
@RequiredArgsConstructor
public class RemediationLinkController {

    private final RemediationLinkService service;

    /** Creates a link and returns the token plus a relative path for the client to resolve. */
    @PostMapping("/{id}/remediation-link")
    @PreAuthorize("hasAnyRole('" + AppRole.ANALYST + "','" + AppRole.CCO + "','" + AppRole.TENANT_ADMIN + "')")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable Long id,
            @AuthenticationPrincipal User u) {
        String token = service.createLink(id, u.getUserId());
        return ResponseEntity.ok(Map.of(
            "token", token,
            "path", service.remediationPath(token)));
    }
}